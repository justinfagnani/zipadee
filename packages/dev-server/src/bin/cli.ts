#!/usr/bin/env node

import {startServer} from '../index.js';
import {
  parseArgs,
  type ParseArgsConfig,
  type ParseArgsOptionDescriptor,
} from 'node:util';

import dedent from 'dedent';

interface ParseArgsOptionDescriptorWithHelp extends ParseArgsOptionDescriptor {
  help?: string;
  defaultDescription?: string;
}

interface ParseArgsOptionsConfigWithHelp {
  [longOption: string]: ParseArgsOptionDescriptorWithHelp;
}

interface ParseArgsConfigWithHelp extends ParseArgsConfig {
  options: ParseArgsOptionsConfigWithHelp;
}

const parseArgsConfig = {
  options: {
    port: {
      type: 'string',
      short: 'p',
      help: 'The port to listen on.',
      default: '8080',
    },
    root: {
      type: 'string',
      short: 'r',
      default: process.cwd(),
      help: 'Root directory to serve files from.',
      defaultDescription: 'Current working directory',
    },
    base: {
      type: 'string',
      short: 'b',
      help: dedent`
        Base directory to resolve paths and imports from, as a relative path
        from the root directory.`,
      default: '',
      defaultDescription: "''",
    },
    ['css-modules']: {
      type: 'boolean',
      help: dedent`
        Whether to transform CSS modules to JavaScript. If true, CSS imports -
        imports with a \`type: 'css'\` import attribute - will be transformed to
        remove the \`type: 'css'\` attribute and add a \`?type=css--module\` query
        parameter to the URL. Requests for these URLs will be served as JavaScript
        modules that export the CSS as a CSSStyleSheet object.`,
      default: false,
    },
    help: {
      type: 'boolean',
      default: false,
      help: 'Show this help message',
    },
  },
} as const satisfies ParseArgsConfigWithHelp;

const generateHelp = (config: ParseArgsConfigWithHelp) => {
  return dedent`
    zpd - Zipadee Dev Server

    Usage: zpd [options]

    Options:
      ${Object.entries(config.options)
        .map(([key, descriptor]) => {
          const {help} = descriptor;
          const args = getArgs(key, descriptor);
          const helpText = help + getDefault(descriptor);
          const indent = ' '.repeat(16 - args.length);
          const helpLines = helpText.split('\n');
          return `${args}${indent}${helpLines.join(`\n${' '.repeat(22)}`)}`;
        })
        .join('\n      ')}

    zpd is a web development server built with Zipadee. It serves JavaScript
    files and rewrites module specifiers to be browser-compatible by resolving
    them to on-disk paths.
    
    zpd serves files from the specified root directory (default: cwd).

    Absolute paths and JavaScript module specifiers are resolved relative to
    the base directory if set, otherwise to the root directory. If a module
    specifier resolves to a path outside of the base directory, it is rewritten
    to be relative to the root directory by prefixing it with the a special root
    path prefix.

    Example:
    
    If you have a monorepo with packages at \`packages/foo\` and \`packages/bar\`
    and you want to serve content from the package \`foo\`, you should set the
    root to the monorepo root and base to \`packages/foo\`.
    
    An import \`bar\` from within the \`foo\` package will be rewritten to
    \`import '/__root__/packages/bar/index.js'\`, and the server will serve
    the file from \`packages/bar/index.js\`.
  `;
};

const getArgs = (
  key: string,
  descriptor: ParseArgsOptionDescriptorWithHelp,
) => {
  let result = `--${key}`;
  if (descriptor.short) {
    result += `, -${descriptor.short}`;
  }
  return result;
};

const getDefault = (descriptor: ParseArgsOptionDescriptorWithHelp) => {
  const defaultValue = descriptor.defaultDescription ?? descriptor.default;
  if (defaultValue === undefined) {
    return '';
  }
  return ` (default: ${defaultValue})`;
};

export const run = async () => {
  const args = parseArgs(parseArgsConfig);

  if (args.values.help) {
    console.log(generateHelp(parseArgsConfig));
    return;
  }
  const port = parseInt(args.values.port);

  console.log('css-modules:', args.values['css-modules']);

  await startServer({
    port,
    rootDir: args.values.root,
    baseDir: args.values.base,
    cssModules: args.values['css-modules'],
  });
};

await run();
