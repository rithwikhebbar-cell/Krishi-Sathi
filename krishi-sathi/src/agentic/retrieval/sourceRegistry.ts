import { AgriculturalSource } from "./types";

export class SourceRegistry {
  private readonly sources = new Map<string, AgriculturalSource>();
  private readonly approvedDomains = new Set<string>();

  constructor() {
    this.registerDefaultSources();
  }

  private registerDefaultSources(): void {
    const defaults: AgriculturalSource[] = [
      {
        domain: "icar.org.in",
        institutionName: "Indian Council of Agricultural Research (ICAR)",
        category: "NATIONAL_RESEARCH",
        isApproved: true,
      },
      {
        domain: "fao.org",
        institutionName: "Food and Agriculture Organization (FAO)",
        category: "INTERNATIONAL",
        isApproved: true,
      },
      {
        domain: "mausam.imd.gov.in",
        institutionName: "India Meteorological Department (IMD)",
        category: "METEOROLOGY",
        isApproved: true,
      },
      {
        domain: "agricoop.nic.in",
        institutionName: "Ministry of Agriculture & Farmers Welfare, India",
        category: "GOVERNMENT",
        isApproved: true,
      },
      {
        domain: "vikaspedia.in",
        institutionName: "Vikaspedia Agricultural Extension Portal",
        category: "GOVERNMENT",
        isApproved: true,
      },
      {
        domain: "pau.edu",
        institutionName: "Punjab Agricultural University (PAU)",
        category: "STATE_UNIVERSITY",
        isApproved: true,
      },
      {
        domain: "tnausms.tn.gov.in",
        institutionName: "Tamil Nadu Agricultural University (TNAU)",
        category: "STATE_UNIVERSITY",
        isApproved: true,
      },
    ];

    for (const src of defaults) {
      this.register(src);
    }
  }

  register(source: AgriculturalSource): void {
    this.sources.set(source.domain.toLowerCase(), source);
    if (source.isApproved) {
      this.approvedDomains.add(source.domain.toLowerCase());
    }
  }

  isDomainApproved(domainOrHost: string): boolean {
    const host = domainOrHost.toLowerCase();
    for (const approved of this.approvedDomains) {
      if (host === approved || host.endsWith(`.${approved}`)) {
        return true;
      }
    }
    return false;
  }

  getSourceForHost(host: string): AgriculturalSource | undefined {
    const h = host.toLowerCase();
    for (const [domain, source] of this.sources.entries()) {
      if (h === domain || h.endsWith(`.${domain}`)) {
        return source;
      }
    }
    return undefined;
  }

  getApprovedDomains(): Set<string> {
    return new Set(this.approvedDomains);
  }

  list(): AgriculturalSource[] {
    return Array.from(this.sources.values());
  }
}
