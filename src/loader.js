import * as path from 'path';
import { getOptions, stringifyRequest } from 'loader-utils';
import { selectAll } from 'unist-util-select';
import GithubSlugger from 'github-slugger';
import toString from 'mdast-util-to-string';
import toHast from '@mdx-js/mdx/mdx-ast-to-mdx-hast';
import visit from 'unist-util-visit';
import remove from 'unist-util-remove';
import raw from 'hast-util-raw';

import { getMarkdownProcessor, getPageData } from './markdown';

const INDEX_PAGE_RE = /^(readme|index)$/i;
const REMAP_ROUTE_RE = /(?:[/\\]?(?:readme|index))?\.md$/i;

export default function loader(source) {
  const options = getOptions(this);

  // Ensure that the template and utilities are relative paths
  const location = options.location || process.cwd();
  const pathPrefix = options.pathPrefix || '';
  const utils = stringifyRequest(this, require.resolve('./index.js'));
  const pagesData = stringifyRequest(this, options.pagesDataFile);
  const processor = getMarkdownProcessor(options.remarkPlugins);

  // Compute the page's originalPath and path
  const relative = path.relative(location, this.resourcePath);
  const originalPath = path.join(
    path.dirname(relative),
    path.basename(relative, '.md')
  );
  const keyPath = (pathPrefix ? [pathPrefix] : [])
    .concat(originalPath.split(path.sep))
    .filter(key => !INDEX_PAGE_RE.test(key));

  // Parse the markdown contents
  const tree = processor.parse(source);
  const pageData = {
    ...getPageData(tree),
    originalPath,
    key: keyPath[keyPath.length - 1],
    path: keyPath.join('/'),
  };

  // Use override template if provided
  const { frontmatter } = pageData;
  const template = stringifyRequest(
    this,
    frontmatter.template
      ? path.resolve(this.context, frontmatter.template)
      : options.defaultTemplate
  );

  // Fix up all links that end in `.md`
  visit(tree, 'link', node => {
    try {
      const [route = '', hash = ''] = node.url.split('#');
      // Only apply to matching URLs
      if (!REMAP_ROUTE_RE.test(route)) return node;
      // Check whether the link's normalised URL is a known markdown file
      if (!path.resolve(this.context, route).startsWith(location)) return node;

      let url = route.replace(REMAP_ROUTE_RE, '/');
      if (hash) url += `#${hash}`;
      node.url = url;
    } catch (_err) {}

    return node;
  });

  // Convert from MAST to HAST
  const hast = toHast()(tree);

  // Convert raw nodes into HAST
  visit(hast, 'raw', node => {
    const { children, tagName, properties } = raw(node);
    node.type = 'element';
    node.children = children;
    node.tagName = tagName;
    node.properties = properties;
  });

  const slugger = new GithubSlugger();
  const assets = [];

  visit(hast, 'element', node => {
    if (/h\d/.test(node.tagName)) {
      node.properties.id = slugger.slug(toString(node));
    } else if (node.tagName === 'img') {
      const { src } = node.properties;
      if (/^\./.test(src)) {
        const path = JSON.stringify(src);
        assets.push(`  [${path}]: require(${path}),\n`);
      }
    }
  });

  // Remove empty text lines
  remove(hast, 'text', node => /^[\n\r]+$/.test(node.value));

  // Remove empty paragraphs
  remove(
    hast,
    'element',
    node => node.tagName === 'p' && node.children.length === 0
  );

  return `
    import React from "react";
    import Template from ${template};
    import pagesData from ${pagesData};
    import { PageContext, hastToMdx } from ${utils};

    var assets = {
      ${assets.join('')}
    };

    var hast = ${JSON.stringify(hast)};
    var pageData = ${JSON.stringify(pageData)};
    var context = { page: pageData, pages: pagesData };

    export default function MarkdownTemplate(props) {
      var mdx = React.useMemo(() => hastToMdx(hast, assets), [hast, assets]);
      return (
        <PageContext.Provider value={context}>
          <Template {...props}>{mdx}</Template>
        </PageContext.Provider>
      );
    };
  `;
}
