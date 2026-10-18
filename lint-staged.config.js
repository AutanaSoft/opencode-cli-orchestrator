export default {
  '**/*.{js,mjs,json,jsonc,yaml,yml}': 'prettier --write',
  '**/*.md': ['prettier --write', 'markdownlint-cli2 --fix', 'prettier --check'],
};
