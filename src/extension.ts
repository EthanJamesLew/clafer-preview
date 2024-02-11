const vscode = require('vscode');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function activate(context) {
    let disposable = vscode.commands.registerCommand('clafer-preview.generateDiagram', function () {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("No active editor.");
            return;
        }

        const document = editor.document;
        const userFilePath = document.fileName;
        const outputPath = userFilePath + ".svg"; // Adjust as needed

        // Fetch user-configured paths
        const chocoSolverPath = vscode.workspace.getConfiguration().get('clafer-preview.chocosolverPath');
        const plantUmlPath = vscode.workspace.getConfiguration().get('clafer-preview.plantumlPath');

        // Execute commands
        runJavaCommands(userFilePath, chocoSolverPath, plantUmlPath, outputPath, function(svgFilePath) {
            const panel = vscode.window.createWebviewPanel(
                'diagram',
                'Diagram',
                vscode.ViewColumn.One,
                {}
            );
            panel.webview.html = getWebviewContent(panel.webview, svgFilePath);
        });
    });

    context.subscriptions.push(disposable, vscode.workspace.onDidSaveTextDocument((document) => {
        vscode.commands.executeCommand('clafer-preview.generateDiagram');
    }));
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
