import assert from "node:assert/strict";
import test from "node:test";
import { consoleProperties, consoleValueText } from "../src/console-values.ts";
import { createScriptConsole, errorEntry } from "../src/script-console.ts";

test("console keeps inspectable values, formats substitutions, and reads only one safe property level", t => {
  t.mock.method(console, "log", () => {});
  const entries = [];
  const scriptConsole = createScriptConsole(entry => entries.push(entry));
  const symbol = Symbol("label");
  let getterCalls = 0;
  const object = {
    nested: { array: [1, { name: "part" }], bigint: 2n },
    get computed() { getterCalls++; throw new Error("getter ran"); },
    toJSON() { throw new Error("toJSON ran"); },
    [symbol]: "symbol value",
  };
  object.self = object;
  scriptConsole.log("object %o / %O %s %i %f %% %c", object, object.nested, "text", "3.8", "2.5px", "color: red", false);
  assert.equal(entries[0].text, "object Object {…} / Object {…} text 3 2.5 %  false");
  assert.deepEqual(entries[0].parts.filter(part => "value" in part).map(part => part.value), [object, object.nested, false]);
  scriptConsole.log(object);
  assert.equal(entries[1].parts.find(part => "value" in part).value, object);
  assert.equal(getterCalls, 0);

  const properties = consoleProperties(object);
  assert.equal(properties.find(property => property.key === "nested").value, object.nested);
  assert.equal(properties.find(property => property.key === "computed").text, "[Getter]");
  assert.equal(properties.find(property => property.key === "self").value, object);
  assert.equal(properties.find(property => property.key === "Symbol(label)").value, "symbol value");
  assert.equal(getterCalls, 0);
  object.nested = { changed: true };
  assert.equal(consoleProperties(object).find(property => property.key === "nested").value, object.nested);
  assert.equal(consoleValueText([1, 2]), "Array(2)");
  assert.equal(consoleValueText("part", true), '"part"');
  assert.equal(consoleValueText(2n), "2n");
  assert.equal(consoleValueText(null), "null");
  assert.equal(consoleValueText(undefined), "undefined");
  assert.equal(consoleValueText(new Error("bad")), "Error: bad");
  assert.equal(consoleValueText(new class Solid {}()), "Solid {…}");
  assert.deepEqual(consoleProperties(new Float32Array([1, 2])), [{ key: "0", value: 1 }, { key: "1", value: 2 }]);
  assert.deepEqual(consoleProperties(new Map([["part", object]])), [{ key: "0", value: { key: "part", value: object } }]);
  assert.deepEqual(consoleProperties(new Set([object])), [{ key: "0", value: object }]);
  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.equal(consoleValueText(revoked.proxy), "[Uninspectable value]");
  assert.deepEqual(consoleProperties(revoked.proxy), [{ key: "", text: "[Unable to inspect properties]" }]);
  assert.equal(new Set([...entries, errorEntry(new Error("bad"))].map(entry => entry.id)).size, 3);
});
