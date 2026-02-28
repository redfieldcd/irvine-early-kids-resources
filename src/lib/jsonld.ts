import { SITE_URL } from "@/lib/constants";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Irvine Early Kids Resources",
    url: SITE_URL,
    logo: `${SITE_URL}/images/og-default.png`,
    description:
      "Community resource directory for parents of children ages 0-7 in Irvine, California.",
    areaServed: {
      "@type": "City",
      name: "Irvine",
      containedInPlace: {
        "@type": "State",
        name: "California",
      },
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function educationalOrgJsonLd(resource: {
  name: string;
  description: string;
  id: number;
  location?: string | null;
  website?: string | null;
  image_url?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: resource.name,
    description: resource.description,
    url: `${SITE_URL}/resources/${resource.id}`,
    ...(resource.location && {
      address: {
        "@type": "PostalAddress",
        addressLocality: "Irvine",
        addressRegion: "CA",
        streetAddress: resource.location,
      },
    }),
    ...(resource.website && { sameAs: resource.website }),
    ...(resource.image_url && {
      image: `${SITE_URL}${resource.image_url}`,
    }),
  };
}
