module.exports = {
  default: {
    paths: ["features/**/*.feature"],
    requireModule: ["tsx/cjs"],
    require: ["tests/step_definitions/**/*.ts"],
    format: ["progress"],
  },
};
