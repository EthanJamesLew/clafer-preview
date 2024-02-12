const vscode = require("vscode");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

let claferPanel = undefined;

function activate(context) {
  let disposable = vscode.commands.registerCommand(
    "clafer-preview.generateDiagram",
    function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage("No active editor.");
        return;
      }

      const document = editor.document;
      const userFilePath = document.fileName;

      // Call the function to generate and display the diagram
      generateAndDisplayDiagram(context, userFilePath);
    },
  );

  context.subscriptions.push(disposable);

  // Add an event listener for save events
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
      if (document.fileName.endsWith(".cfr")) {
        // Check if the file extension is .clafer
        vscode.commands.executeCommand("clafer-preview.generateDiagram");
      }
    }),
  );
}

function generateAndDisplayDiagram(context, userFilePath) {
  const outputPath = userFilePath + ".svg"; // Adjust as needed
  // Fetch user-configured paths
  const chocoSolverPath = vscode.workspace
    .getConfiguration()
    .get("clafer-preview.chocosolverPath");
  const plantUmlPath = vscode.workspace
    .getConfiguration()
    .get("clafer-preview.plantumlPath");

  console.log("run java commands");
  runJavaCommands(
    userFilePath,
    chocoSolverPath,
    plantUmlPath,
    outputPath,
    function (svgFilePath, chocosolverOut, plantumlOut) {
      if (!claferPanel) {
        claferPanel = vscode.window.createWebviewPanel(
          "claferDiagram",
          "Clafer Diagram",
          getColumnForPanel(), // Dynamically choose the column
          { enableScripts: true },
        );

        claferPanel.onDidDispose(
          () => {
            claferPanel = undefined;
          },
          null,
          context.subscriptions,
        );

        // Listen for view state changes to refresh the diagram as needed
        claferPanel.onDidChangeViewState(
          () => {
            generateAndDisplayDiagram(context, userFilePath); // Re-generate and display diagram upon view state changes

            if (claferPanel) {
              claferPanel.webview.postMessage({
                command: "update",
                content: new Date().toString(),
              });
            }
          },
          null,
          context.subscriptions,
        );
      }

      console.log("update claferPanel");
      claferPanel.webview.html = getWebviewContent(
        claferPanel.webview,
        svgFilePath,
        chocosolverOut,
        plantumlOut,
      );
    },
  );
}

function getWebviewContent(webview, svgFilePath, chocosolverOut, plantumlOut) {
  const uniqueId = Date.now(); // Define a unique ID for cache busting
  const src =
    webview.asWebviewUri(vscode.Uri.file(svgFilePath)) + `?v=${uniqueId}`; // Append uniqueId to the src URL

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Clafer Diagram</title>
</head>
<body>
    <h1>Feature Model</h1>
    <img id="dynamicImage" src="${src}?v=${uniqueId}" />
    <h2>Chocosolver Output</h2>
        <p>${chocosolverOut}</p>
    <h2>Plantuml Output</h2>
        <p>${plantumlOut}</p>
</body>
</html>`;
}

function getColumnForPanel() {
  // Attempt to place the webview in the column to the side of the active editor
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return vscode.ViewColumn.Two;
  }

  switch (activeEditor.viewColumn) {
    case vscode.ViewColumn.One:
      return vscode.ViewColumn.Two;
    case vscode.ViewColumn.Two:
      return vscode.ViewColumn.Three;
    default:
      return vscode.ViewColumn.One;
  }
}

function deactivate() {}

function runJavaCommands(
  userFilePath,
  chocoSolverPath,
  plantUmlPath,
  outputPath,
  callback,
) {
  const pumlOutputPath = path.join(path.dirname(outputPath), "output.puml");
  const chocoCmd = `java -jar "${chocoSolverPath}" --file "${userFilePath}" --plantuml -o "${pumlOutputPath}"`;

  exec(chocoCmd, (error, chocoStdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      vscode.window.showErrorMessage("Error running chocosolver command.");
      return;
    }

    const plantUmlCmd = `java -jar "${plantUmlPath}" -tsvg "${pumlOutputPath}"`;
    exec(plantUmlCmd, (error, pumlStdout, stderr) => {
      if (error) {
        console.error(`exec error: ${error}`);
        vscode.window.showErrorMessage("Error running PlantUML command.");
        return;
      }

      // Assuming the PlantUML command replaces .puml extension with .svg
      const svgOutputPath = pumlOutputPath.replace(/\.puml$/, ".svg");
      if (typeof callback === "function") {
        callback(svgOutputPath, chocoStdout, pumlStdout);
      }
    });
  });
}

exports.activate = activate;
exports.deactivate = deactivate;
