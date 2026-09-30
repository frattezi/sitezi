import * as cloudflare from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';

const config = new pulumi.Config();

const accountId = config.require('accountId');
const zoneId = config.require('zoneId');
const hostname = config.require('hostname');
const workerName = config.require('workerName');

/**
 * This program owns the Cloudflare *account* infrastructure: the hostname that
 * fronts the site and the certificate in front of it.
 *
 * It deliberately does NOT declare the Worker script or its assets. `wrangler
 * deploy` (from wrangler.jsonc) owns those, and two tools writing the same
 * Cloudflare resource means `pulumi up` reverts whatever the last deploy
 * published. See AGENTS.md → Infrastructure.
 *
 * WorkersCustomDomain creates its own proxied DNS record and provisions the
 * edge certificate, so there must be no cloudflare.DnsRecord for this hostname
 * — declaring one collides with the record this resource manages.
 */
export const siteDomain = new cloudflare.WorkersCustomDomain('site', {
  accountId,
  zoneId,
  hostname,
  service: workerName,
});

export const siteHostname = siteDomain.hostname;
