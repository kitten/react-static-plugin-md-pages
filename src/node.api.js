import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

import { getPages } from './markdown';

const writeFile = promisify(fs.writeFile);

const staticPluginSourceMarkdown = (opts = {}) => ({
  async getRoutes(_, { config }) {
    // Resolve target location from ROOT folder
    const location = path.resolve(config.paths.ROOT, opts.location);
    const pagesDataFile = path.resolve(config.paths.ARTIFACTS, 'pages.json');

    // Get page data for each discovered markdown file
    const pages = await getPages(
      location,
      opts.remarkPlugins,
      opts.pathPrefix,
      opts.order
    );

    await writeFile(pagesDataFile, JSON.stringify(pages));

    // Convert the page tree into the react-static route structure
    const groupToPage = page => ({
      path: page.key,
      template: page.originalPath
        ? `${path.resolve(location, page.originalPath)}.md`
        : undefined,
      children:
        page.children.length > 0 ? page.children.map(groupToPage) : undefined,
    });

    return [groupToPage(pages)];
  },
  afterGetConfig({ config }) {
    // Register `md` files as a valid extension with react-static
    config.extensions = [...config.extensions, '.md'];
  },
  webpack(webpackConfig, { config, defaultLoaders }) {
    // Resolve target location and template from ROOT folder
    const location = path.resolve(config.paths.ROOT, opts.location);
    const pagesDataFile = path.resolve(config.paths.ARTIFACTS, 'pages.json');
    const defaultTemplate = path.resolve(config.paths.ROOT, opts.template);

    // Create a rule that only applies to the discovered markdown files
    webpackConfig.module.rules[0].oneOf.unshift({
      test: /.md$/,
      // Limit the rule strictly to the files we have
      include: [location],
      use: [
        defaultLoaders.jsLoader.use[0],
        // The loader will parse the markdown to an MDX-compatible HAST
        // and will wrap it in the actual template given in `opts.template`
        {
          loader: require.resolve('./loader'),
          options: {
            remarkPlugins: opts.remarkPlugins,
            pathPrefix: opts.pathPrefix,
            defaultTemplate,
            pagesDataFile,
            location,
          },
        },
      ],
    });

    return webpackConfig;
  },
});

export default staticPluginSourceMarkdown;
