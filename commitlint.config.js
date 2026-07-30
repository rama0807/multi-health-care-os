/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // new feature
        'fix',      // bug fix
        'chore',    // maintenance, deps
        'docs',     // documentation
        'style',    // formatting, no logic change
        'refactor', // code restructure, no behavior change
        'perf',     // performance improvement
        'test',     // adding/fixing tests
        'build',    // build system changes
        'ci',       // CI/CD changes
        'revert',   // revert a commit
      ],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'auth',
        'patients',
        'appointments',
        'medical-records',
        'prescriptions',
        'laboratory',
        'radiology',
        'billing',
        'insurance',
        'pharmacy',
        'inventory',
        'staff',
        'notifications',
        'ai',
        'organizations',
        'users',
        'database',
        'ui',
        'types',
        'config',
        'docker',
        'ci',
        'deps',
      ],
    ],
    'subject-case': [2, 'always', 'lower-case'],
    'body-max-line-length': [1, 'always', 100],
  },
}
