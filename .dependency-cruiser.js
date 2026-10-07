module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'This dependency is part of a circular relationship.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'platform-is-independent',
      severity: 'error',
      comment: 'Platform modules should not depend on domain modules.',
      from: { path: '^server/modules/Platform' },
      to: { path: '^server/modules/(?!Platform)' },
    },
    {
      name: 'no-cross-module-unless-explicit',
      severity: 'error',
      comment:
        "Cross-module dependencies must be deliberate. Currently, we enforce that domain modules cannot cyclically import, which is covered above, but let's restrict direct DB schema imports outside Platform/Database if we want, or just enforce a DAG.",
      from: { path: '^server/modules/([^/]+)/' },
      to: {
        path: '^server/modules/([^/]+)/',
        pathNot: '^server/modules/$1/',
      },
    },
  ],
  options: {
    exclude: '^node_modules',
  },
};
