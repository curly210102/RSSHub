import { directoryImport } from 'directory-import';
import type { Hono, Handler } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import * as path from 'node:path';

import index from '@/v2/index';
import robotstxt from '@/v2/robots.txt';

type Root = {
    get: (routePath: string, filePath: string) => void;
};

const imports = directoryImport({
    targetDirectoryPath: './v2',
    importPattern: /router\.js$/,
});

const routes: Record<string, (root: Root) => void> = {};

for (const path in imports) {
    const name = path.split('/').find(Boolean);
    if (name) {
        routes[name] = imports[path] as (root: Root) => void;
    }
}

export default function (app: Hono) {
    for (const name in routes) {
        const subApp = app.basePath(`/${name}`);
        routes[name]({
            get: (routePath, filePath) => {
                const wrapedHandler: Handler = async (ctx, ...args) => {
                    if (!ctx.get('data')) {
                        const handler = require(path.join(__dirname, 'v2', name, filePath));
                        await handler(ctx, ...args);
                    }
                };
                subApp.get(routePath, wrapedHandler);
            },
        });
    }

    // routes without rss data
    app.get('/', index);
    app.get('/robots.txt', robotstxt);

    app.use(
        '/*',
        serveStatic({
            root: './lib/assets',
        })
    );
}
