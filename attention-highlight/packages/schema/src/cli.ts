import { readFile, writeFile } from "node:fs/promises";
import {
  assertProductionPackage,
  validateLevelPackage,
} from "./validate.js";

function usage(): never {
  console.error(
    [
      "用法：",
      "  schema validate <levels.json> [--mode draft|release]",
      "  schema package <levels.json> <output.json> [--mode draft|release]",
    ].join("\n"),
  );
  process.exit(2);
}

const args = process.argv.slice(2);
const command = args.shift();
const modeFlag = args.indexOf("--mode");
const mode = modeFlag >= 0 ? args[modeFlag + 1] : "draft";
if (modeFlag >= 0) {
  args.splice(modeFlag, 2);
}
const [inputPath, outputPath] = args;
if (!command || !inputPath) {
  usage();
}

if (mode !== "draft" && mode !== "release") {
  usage();
}

const raw = JSON.parse(await readFile(inputPath, "utf8")) as unknown;

if (command === "validate") {
  const result =
    mode === "release"
      ? (() => {
          try {
            return { ok: true as const, value: assertProductionPackage(raw) };
          } catch (error) {
            if (
              error instanceof Error &&
              "issues" in error &&
              Array.isArray(error.issues)
            ) {
              return { ok: false as const, errors: error.issues };
            }
            throw error;
          }
        })()
      : validateLevelPackage(raw, "draft");
  if (!result.ok) {
    console.error(JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }
  console.log(
    `校验通过：${result.value.levels.length} 句，模式 ${mode}，状态 ${result.value.status}`,
  );
  process.exit(0);
}

if (command === "package" && outputPath) {
  const result =
    mode === "release"
      ? validateLevelPackage(raw, "release")
      : validateLevelPackage(raw, "draft");
  if (!result.ok) {
    console.error(JSON.stringify(result.errors, null, 2));
    process.exit(1);
  }
  await writeFile(outputPath, `${JSON.stringify(result.value, null, 2)}\n`);
  console.log(`已写入 ${outputPath}`);
  process.exit(0);
}

usage();
