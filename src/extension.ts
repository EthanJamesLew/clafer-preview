const vscode = require('vscode');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

let claferPanel = undefined;

function activate(context) {
    let disposable = vscode.commands.registerCommand('clafer-preview.generateDiagram', function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor.");
            return;
        }

        const document = editor.document;
        const userFilePath = document.fileName;

        // Call the function to generate and display the diagram
        generateAndDisplayDiagram(context, userFilePath);
    });

    context.subscriptions.push(disposable);
}

function generateAndDisplayDiagram(context, userFilePath) {
    const outputPath = userFilePath + ".svg"; // Adjust as needed
    // Fetch user-configured paths
    const chocoSolverPath = vscode.workspace.getConfiguration().get('clafer-preview.chocosolverPath');
    const plantUmlPath = vscode.workspace.getConfiguration().get('clafer-preview.plantumlPath');

    console.log("run java commands");
    runJavaCommands(userFilePath, chocoSolverPath, plantUmlPath, outputPath, function(svgFilePath) {
        if (!claferPanel) {
            claferPanel = vscode.window.createWebviewPanel(
                'claferDiagram',
                'Clafer Diagram',
                getColumnForPanel(), // Dynamically choose the column
                { enableScripts: true }
            );

            claferPanel.onDidDispose(() => {
                claferPanel = undefined;
            }, null, context.subscriptions);

            // Listen for view state changes to refresh the diagram as needed
            claferPanel.onDidChangeViewState(() => {
                generateAndDisplayDiagram(context, userFilePath); // Re-generate and display diagram upon view state changes
            }, null, context.subscriptions);
        }

        console.log("update claferPanel");
        claferPanel.webview.html = getWebviewContent(claferPanel.webview, svgFilePath);
    });
}

function getWebviewContent(webview, svgFilePath) {
    // Convert the file system path to a URI that can be used in the webview
    const uniqueId = new Date.now().toString();
    const src = webview.asWebviewUri(vscode.Uri.file(svgFilePath));
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Clafer Diagram</title>
    </head>
    <body>
        Feature Model
        <img src="${src}?v=${uniqueId}" />
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

function getWebviewContent(webview, svgFilePath) {
    // Construct the path for the img src attribute correctly for webview
    const src = webview.asWebviewUri(vscode.Uri.file(svgFilePath));
    // const src = onDiskPath.with({ scheme: 'vscode-resource' }).toString();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Diagram</title>
    </head>
    <body>
        <img src="${src}" />
    </body>
    </html>`;
}

function runJavaCommands(userFilePath, chocoSolverPath, plantUmlPath, outputPath, callback) {
    const pumlOutputPath = path.join(path.dirname(outputPath), 'output.puml');
    const chocoCmd = `java -jar "${chocoSolverPath}" --file "${userFilePath}" --plantuml -o "${pumlOutputPath}"`;

    exec(chocoCmd, (error, stdout, stderr) => {
        if (error) {
            console.error(`exec error: ${error}`);
            vscode.window.showErrorMessage("Error running chocosolver command.");
            return;
        }

        const plantUmlCmd = `java -jar "${plantUmlPath}" -tsvg "${pumlOutputPath}"`;
        exec(plantUmlCmd, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                vscode.window.showErrorMessage("Error running PlantUML command.");
                return;
            }

            // Assuming the PlantUML command replaces .puml extension with .svg
            const svgOutputPath = pumlOutputPath.replace(/\.puml$/, '.svg');
            if (typeof callback === 'function') {
                callback(svgOutputPath);
            }
        });
    });
}

exports.activate = activate;
exports.deactivate = deactivate;
