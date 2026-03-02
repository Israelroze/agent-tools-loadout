import * as vscode from 'vscode';
import { EXTENSION_NAME } from './constants';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(EXTENSION_NAME);
  }
  return outputChannel;
}

export function info(message: string): void {
  getOutputChannel().appendLine(`[INFO] ${message}`);
  console.log(`[Agent Loadout] ${message}`);
}

export function warn(message: string): void {
  getOutputChannel().appendLine(`[WARN] ${message}`);
  console.warn(`[Agent Loadout] ${message}`);
}

export function error(message: string): void {
  getOutputChannel().appendLine(`[ERROR] ${message}`);
  console.error(`[Agent Loadout] ${message}`);
}
