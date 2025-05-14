
import katex from 'katex';
import { $applyNodeReplacement, DecoratorNode, DOMExportOutput } from 'lexical';
import { ReactElement } from 'react';

import EquationComponent from './EquationComponent';

import type {
  DOMConversionMap,
  DOMConversionOutput,
  EditorConfig,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from 'lexical';

export type SerializedEquationNode = Spread<
  {
    equation: string;
    inline: boolean;
    startInEditMode?: boolean;
  },
  SerializedLexicalNode
>;

function $convertEquationElement(
  domNode: HTMLElement,
): null | DOMConversionOutput {
  let equation = domNode.getAttribute('data-lexical-equation');
  const inline = domNode.getAttribute('data-lexical-inline') === 'true';
  const startInEditMode = domNode.getAttribute('data-lexical-start-edit') === 'true';
  // Decode the equation from base64
  equation = atob(equation || '');
  if (equation) {
    const node = $createEquationNode(equation, inline, startInEditMode);
    return {node};
  }

  return null;
}

export class EquationNode extends DecoratorNode<ReactElement> {
  __equation: string;
  __inline: boolean;
  __startInEditMode: boolean; 

  static getType(): string {
    return 'equation';
  }

  static clone(node: EquationNode): EquationNode {
    return new EquationNode(node.__equation, node.__inline, node.__startInEditMode, node.__key);
  }

  constructor(equation: string, inline?: boolean, startInEditMode?: boolean, key?: NodeKey) {
    super(key);
    this.__equation = equation;
    this.__inline = inline ?? false;
    this.__startInEditMode = startInEditMode ?? false;
  }

  static importJSON(serializedNode: SerializedEquationNode): EquationNode {
    return $createEquationNode(
      serializedNode.equation,
      serializedNode.inline,
      serializedNode.startInEditMode ?? false, 
    ).updateFromJSON(serializedNode);
  }

  exportJSON(): SerializedEquationNode {
    return {
      ...super.exportJSON(),
      equation: this.getEquation(),
      inline: this.__inline,
      startInEditMode: this.__startInEditMode,
    };
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const element = document.createElement(this.__inline ? 'span' : 'div');
    element.className = this.__inline 
      ? 'editor-equation editor-equation-inline' 
      : 'editor-equation editor-equation-block';
    return element;
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement(this.__inline ? 'span' : 'div');
    // Encode the equation as base64 to avoid issues with special characters
    const equation = btoa(this.__equation);
    element.setAttribute('data-lexical-equation', equation);
    element.setAttribute('data-lexical-inline', `${this.__inline}`);
    element.setAttribute('data-lexical-start-edit', `${this.__startInEditMode}`);
    katex.render(this.__equation, element, {
      displayMode: !this.__inline,
      errorColor: '#cc0000',
      output: 'html',
      strict: 'warn',
      throwOnError: false,
      trust: false,
    });
    return {element};
  }

  static importDOM(): DOMConversionMap | null {
    return {
      div: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-lexical-equation')) {
          return null;
        }
        return {
          conversion: $convertEquationElement,
          priority: 2,
        };
      },
      span: (domNode: HTMLElement) => {
        if (!domNode.hasAttribute('data-lexical-equation')) {
          return null;
        }
        return {
          conversion: $convertEquationElement,
          priority: 1,
        };
      },
    };
  }

  updateDOM(prevNode: this): boolean {
    // If the inline property changes, replace the element
    return this.__inline !== prevNode.__inline;
  }

  clearStartInEditMode(): void {
    if (this.__startInEditMode) {
      const writable = this.getWritable();
      writable.__startInEditMode = false;
    }
  }

  getTextContent(): string {
    return this.__equation;
  }

  getEquation(): string {
    return this.__equation;
  }

  setEquation(equation: string): void {
    const writable = this.getWritable();
    writable.__equation = equation;
  }

  shouldStartInEditMode(): boolean {
    return this.__startInEditMode;
  }

  decorate(): ReactElement {
    return (
      <EquationComponent
        equation={this.__equation}
        inline={this.__inline}
        nodeKey={this.__key}
        startInEditMode={this.__startInEditMode}
      />
    );
  }
}

export function $createEquationNode(
  equation = '',
  inline = false,
  startInEditMode = false,
): EquationNode {
  const equationNode = new EquationNode(equation, inline, startInEditMode);
  return $applyNodeReplacement(equationNode);
}

export function $isEquationNode(
  node: LexicalNode | null | undefined,
): node is EquationNode {
  return node instanceof EquationNode;
}