import ts from 'typescript'

/** Deliberately focused: visible JSX text, accessible labels, and literal JSX expressions. */
export function interfaceLiterals(file: string, source: string) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const entries: { id: string; text: string; line: number }[] = []
  const add = (node: ts.Node, text: string) => {
    text = text.trim().replace(/\s+/g, ' ')
    if (!/[\p{L}]/u.test(text)) return
    entries.push({ id: `${file}: ${text}`, text, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 })
  }
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) add(node, node.text)
    if (ts.isJsxAttribute(node) && ['aria-label', 'aria-roledescription', 'title', 'placeholder', 'alt'].includes(node.name.getText(ast)) && node.initializer && ts.isStringLiteral(node.initializer)) add(node, node.initializer.text)
    if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression) && !ts.isJsxAttribute(node.parent)) add(node, node.expression.text)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  return entries
}
