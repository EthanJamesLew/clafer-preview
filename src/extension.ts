// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";

function activate(context) {
  let disposable = vscode.commands.registerCommand(
    "extension.generateDiagram",
    function () {
      // Logic to generate the diagram
      const panel = vscode.window.createWebviewPanel(
        "diagram", // Identifies the type of the webview
        "Diagram", // Title of the panel
        vscode.ViewColumn.One, // Editor column to show the new webview panel in
        {}, // Webview options
      );

      panel.webview.html = getWebviewContent(); // Function to generate HTML content for the diagram
    },
  );

  context.subscriptions.push(
    disposable,
    vscode.workspace.onDidSaveTextDocument((document) => {
      vscode.commands.executeCommand("extension.generateDiagram");
    }),
  );
}

function deactivate() {}

function getWebviewContent() {
  // Return HTML content that represents your diagram
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Diagram</title>
    </head>
    <body>
        <img src="data:image/svg+xml,${encodeURIComponent(YOUR_DIAGRAM_DATA)}" />
    </body>
    </html>`;
}

exports.activate = activate;
exports.deactivate = deactivate;
