import { URL } from "url";
import { ValidationError } from "../contracts/errors";

export class SecurityError extends Error {
  constructor(message: string) {
    super(`Security policy violation: ${message}`);
    this.name = "SecurityError";
  }
}

/**
 * SSRF Protection Validator:
 * Blocks internal networks, loopback, cloud metadata endpoints, and non-HTTP protocols.
 */
export class SSRFValidator {
  private static readonly BLOCKED_HOST_PATTERNS = [
    /^localhost$/i,
    /\.local$/i,
    /\.internal$/i,
    /\.localhost$/i,
    /^metadata\.google\.internal$/i,
    /^169\.254\.169\.254$/, // AWS / GCP metadata
    /^instance-data$/i,
  ];

  /**
   * Validates if an IP address string falls inside private, loopback, or link-local ranges.
   */
  static isPrivateOrReservedIP(ip: string): boolean {
    const cleanIp = ip.trim().replace(/^\[|\]$/g, "").replace(/^::ffff:/, ""); // handle IPv4-mapped IPv6 and bracketed IPv6

    // IPv4 private ranges
    // 127.0.0.0/8 (Loopback)
    if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;
    // 10.0.0.0/8 (Private)
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;
    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255 Private)
    const match172 = cleanIp.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match172) {
      const secondOctet = parseInt(match172[1], 10);
      if (secondOctet >= 16 && secondOctet <= 31) return true;
    }
    // 192.168.0.0/16 (Private)
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;
    // 169.254.0.0/16 (Link-local / Cloud metadata)
    if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;
    // 0.0.0.0/8
    if (/^0\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanIp)) return true;

    // IPv6 private & loopback ranges
    if (cleanIp === "::1" || cleanIp === "::") return true;
    if (cleanIp.toLowerCase().startsWith("fc00:") || cleanIp.toLowerCase().startsWith("fd00:")) return true; // Unique local
    if (cleanIp.toLowerCase().startsWith("fe80:")) return true; // Link-local

    return false;
  }

  /**
   * Validates a URL against SSRF rules, protocol whitelist, and domain policies.
   */
  static validateUrl(
    urlString: string,
    options: {
      allowedDomains?: Set<string>;
      allowAnyPublicDomain?: boolean;
    } = {}
  ): URL {
    let parsed: URL;
    try {
      parsed = new URL(urlString);
    } catch {
      throw new ValidationError(`Invalid URL format: '${urlString}'`);
    }

    // 1. Protocol check: only http and https
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new SecurityError(`Protocol '${parsed.protocol}' is forbidden. Only HTTP and HTTPS are permitted.`);
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Check forbidden host patterns
    for (const pattern of this.BLOCKED_HOST_PATTERNS) {
      if (pattern.test(hostname)) {
        throw new SecurityError(`Host '${hostname}' is a reserved internal or metadata destination.`);
      }
    }

    // 3. Direct IP address check
    if (this.isPrivateOrReservedIP(hostname)) {
      throw new SecurityError(`Host IP '${hostname}' resolves to a private or internal network range.`);
    }

    // 4. Port check: allow standard HTTP (80) and HTTPS (443) or unspecified
    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
      throw new SecurityError(`Non-standard port '${parsed.port}' is blocked by security policy.`);
    }

    // 5. Allowed domains whitelist check
    if (!options.allowAnyPublicDomain && options.allowedDomains && options.allowedDomains.size > 0) {
      let isDomainAllowed = false;
      for (const allowed of options.allowedDomains) {
        if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
          isDomainAllowed = true;
          break;
        }
      }
      if (!isDomainAllowed) {
        throw new SecurityError(
          `Domain '${hostname}' is not in the approved agricultural source whitelist.`
        );
      }
    }

    return parsed;
  }
}
