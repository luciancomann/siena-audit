/**
 * The helpdesks the audit can connect to. Logos are the exact marks the
 * clone's integrations page ships (localized Framer assets).
 */
export interface HelpdeskProvider {
  slug: string;
  name: string;
  logo: string;
  workspaceHint: string;
}

export const HELPDESK_PROVIDERS: HelpdeskProvider[] = [
  {
    slug: "gorgias",
    name: "Gorgias",
    logo: "/assets/images/ZpQsnilKyFbI5NQQsprab6HOs.png",
    workspaceHint: "yourbrand.gorgias.com",
  },
  {
    slug: "zendesk",
    name: "Zendesk",
    logo: "/assets/images/v1LK1P0YPWAVUmwmBoeVohESw0.png",
    workspaceHint: "yourbrand.zendesk.com",
  },
  {
    slug: "kustomer",
    name: "Kustomer",
    logo: "/assets/images/t1V7PXseOtWHVdUxRSbPO9Hn7kE.png",
    workspaceHint: "yourbrand.kustomerapp.com",
  },
  {
    slug: "intercom",
    name: "Intercom",
    logo: "/assets/images/IC1TKHoJhht3mWPgnSBXLkdT5U.png",
    workspaceHint: "app.intercom.com/a/apps/yourbrand",
  },
  {
    slug: "gladly",
    name: "Gladly",
    logo: "/assets/images/BojPfDQgcjGS6jdOP9zT9oav3s.png",
    workspaceHint: "yourbrand.gladly.com",
  },
];
