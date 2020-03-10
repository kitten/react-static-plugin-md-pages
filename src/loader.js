import { resolve } from 'path';
import { getOptions, stringifyRequest } from 'loader-utils';
import { selectAll } from 'unist-util-select';
import GithubSlugger from 'github-slugger';
import toString from 'mdast-util-to-string';
import toHast from '@mdx-js/mdx/mdx-ast-to-mdx-hast';
import visit from 'unist-util-visit';
import remove from 'unist-util-remove';
import raw from 'hast-util-raw';

import { getMarkdownProcessor, getPageData } from './markdown';

const INDEX_ROUTE_RE = /(?:[/\\]?(?:readme|index))\.md$/i;
const REMAP_ROUTE_RE = /(?:[/\\]?(?:readme|index))?\.md$/i;

export default function loader(source) {
  const options = getOptions(this);

  // Ensure that the template and utilities are relative paths
  const location = options.location || process.cwd();
  const utils = stringifyRequest(this, require.resolve('./index.js'));
  const processor = getMarkdownProcessor(options.remarkPlugins);

  // Parse the markdown contents
  const tree = processor.parse(source);
  const { frontmatter } = getPageData(tree);

  // Use override template if provided
  const template = stringifyRequest(
    this,
    frontmatter.template
      ? resolve(this.context, frontmatter.template)
      : options.defaultTemplate
  );

  // Fix up all links that end in `.md`
  visit(tree, 'link', node => {
    try {
      const [route = '', hash = ''] = node.url.split('#');
      // Only apply to matching URLs
      if (!REMAP_ROUTE_RE.test(route)) return node;
      // Check whether the link's normalised URL is a known markdown file
      if (resolve(this.context, route).startsWith(location)) {
        // If so remove the `.md` extension
        node.url = route.replace(REMAP_ROUTE_RE, '');
        if (INDEX_ROUTE_RE.test(route)) node.url += '/';
        if (hash) node.url += `#${hash}`;
      }
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
    import { useRouteData } from "react-static";
    import Template from ${template};
    import { hastToMdx } from ${utils};

    var assets = {
      ${assets.join('')}
    };

    var hast = ${JSON.stringify(hast)};

    export default function MarkdownTemplate(props) {
      var mdx = React.useMemo(() => hastToMdx(hast, assets), [hast, assets]);
      return <Template {...props}>{mdx}</Template>;
    };
  `;
}
