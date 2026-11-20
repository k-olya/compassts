import { readFileSync, realpathSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { Plugin } from "vite";

const libraryRoot = realpathSync(fileURLToPath(new URL("../node_modules/libcompass/", import.meta.url)));
const sourceRoot = join(libraryRoot, "src");
const moduleId = "virtual:libcompass-api";

function documentation(node: ts.Node) {
  // Read block tags as text: TypeScript's JSDoc parser splits TSDoc's @throws {@link ...}.
  const text = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc).map(comment => comment.getText()
    .replace(/^\/\*\*|\*\/$/g, "").split("\n").map(line => line.replace(/^\s*\* ?/, "")).join("\n").trim()).join("\n\n");
  const [description, ...blocks] = text.split(/^@(\w+)[ \t]*/m);
  const tags: { name: string; text: string }[] = [];
  for (let index = 0; index < blocks.length; index += 2) {
    const name = blocks[index];
    const content = blocks[index + 1].trim();
    tags.push({ name, text: name === "param" || name === "typeParam" ? content.replace(/^(\S+)\s+-\s*/, "$1 — ") : content });
  }
  return {
    description,
    tags,
  };
}

export function readLibcompassApi() {
  const outputRoot = join(libraryRoot, "__api__");
  const entry = join(sourceRoot, "index.ts");
  const program = ts.createProgram([entry], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    strict: true,
    skipLibCheck: true,
    declaration: true,
    emitDeclarationOnly: true,
    rootDir: sourceRoot,
    outDir: outputRoot,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: name => name,
    getCurrentDirectory: () => libraryRoot,
    getNewLine: () => "\n",
  }));
  const checker = program.getTypeChecker();
  const exports = checker.getExportsOfModule(checker.getSymbolAtLocation(program.getSourceFile(entry)!)!).map(symbol => symbol.name);
  const libraries: Record<string, string> = {};
  program.emit(undefined, (path, content) => {
    if (path.endsWith(".d.ts")) libraries[`file:///node_modules/libcompass/${relative(outputRoot, path).replaceAll("\\", "/")}`] = content;
  });
  const printer = ts.createPrinter({ removeComments: true });
  const entries = Object.entries(libraries).flatMap(([path, content]) => {
    const source = ts.createSourceFile(path, content, ts.ScriptTarget.Latest, true);
    return source.statements.flatMap(node => {
      if (!(ts.isClassDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node))
        || !node.name || !exports.includes(node.name.text)) return [];
      const signatureNode = ts.isClassDeclaration(node)
        ? ts.factory.updateClassDeclaration(node, node.modifiers, node.name, node.typeParameters, node.heritageClauses, [])
        : ts.isInterfaceDeclaration(node) ? ts.factory.updateInterfaceDeclaration(node, node.modifiers, node.name, node.typeParameters, node.heritageClauses, []) : node;
      const signature = printer.printNode(ts.EmitHint.Unspecified, signatureNode, source)
        .replace(/^export (?:declare )?/, "").replace(/\s*\{\s*\}$/, "");
      const documentedMembers = ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)
        ? node.members.map(member => ({ member, prefix: "" }))
        : ts.isFunctionDeclaration(node) ? node.parameters.flatMap(parameter =>
          parameter.type && ts.isTypeLiteralNode(parameter.type)
            ? parameter.type.members.map(member => ({ member, prefix: `${parameter.name.getText(source)}.` })) : []) : [];
      const members = documentedMembers.flatMap(({ member, prefix }) => {
        if (ts.getCombinedModifierFlags(member) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) return [];
        return [{
          name: ts.isConstructorDeclaration(member) ? "constructor" : prefix + (member.name?.getText(source) ?? ""),
          signature: printer.printNode(ts.EmitHint.Unspecified, member, source),
          ...documentation(member),
        }];
      });
      const docs = documentation(node);
      const folder = ts.isFunctionDeclaration(node)
        ? docs.description.includes("Constructor shorthand for") ? "shorthands" : path.includes("/operations/") ? "operations" : "util"
        : "classes";
      return [{ name: node.name.text, folder, kind: ts.isClassDeclaration(node) ? "Class" : ts.isInterfaceDeclaration(node) ? "Interface" : ts.isFunctionDeclaration(node) ? "Function" : "Type", signature, ...docs, members }];
    });
  }).sort((a, b) => a.name.localeCompare(b.name));
  for (const path of Object.keys(libraries)) {
    libraries[path] = libraries[path].replace(/(@throws\s+)\{@link\s+([^}]+)\}/g, "$1`$2`");
  }
  libraries["file:///node_modules/gl-matrix/index.d.ts"] = readFileSync(fileURLToPath(new URL("../node_modules/gl-matrix/index.d.ts", import.meta.url)), "utf8");
  libraries["file:///cad-globals.d.ts"] = `
import * as compass from "libcompass";
import * as matrix from "gl-matrix";
declare global {
  ${exports.map(name => `export import ${name} = compass.${name};`).join("\n  ")}
  ${["glMatrix", "mat2", "mat2d", "mat3", "mat4", "quat", "quat2", "vec2", "vec3", "vec4"].map(name => `export import ${name} = matrix.${name};`).join("\n  ")}
  /** Root of the current scene. Add solids and other nodes with scene.add(...children). */
  var scene: compass.Node;
}
`;
  return { libraries, entries };
}

export function libcompassApi(): Plugin {
  return {
    name: "libcompass-api",
    resolveId: id => id === moduleId ? `\0${moduleId}` : undefined,
    load: id => id === `\0${moduleId}` ? `export default ${JSON.stringify(readLibcompassApi())}` : undefined,
    configureServer(server) { server.watcher.add(sourceRoot); },
    handleHotUpdate(context) {
      if (!context.file.startsWith(`${sourceRoot}/`)) return;
      const module = context.server.moduleGraph.getModuleById(`\0${moduleId}`);
      if (module) {
        context.server.moduleGraph.invalidateModule(module);
        return [module];
      }
    },
  };
}
