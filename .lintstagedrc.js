const path = require("path");

const buildNextEslintCommand = (filenames) => {
  const cwd = path.join(process.cwd(), "core");
  const relativeFiles = filenames
    .map((f) => path.relative(cwd, f))
    .join(" ");
  return `cd core && eslint --fix ${relativeFiles}`;
};

const checkTypesNextCommand = () => "cd core && yarn check-types";

module.exports = {
  "core/**/*.{ts,tsx}": [
    buildNextEslintCommand,
    checkTypesNextCommand,
  ],
  "core/**/*.{js,jsx}": [buildNextEslintCommand],
};
