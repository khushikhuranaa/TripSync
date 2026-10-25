import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

export const metadata = { title: "Photo credits" };

const photos = [
  {
    file: "Palolem Beach, South Goa",
    used: "Goa trip cover",
    author: "iMahesh",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:Palolem_Beach,_South_Goa.jpg",
  },
  {
    file: "East facade Hawa Mahal Jaipur from ground level (July 2022)",
    used: "Jaipur trip cover",
    author: "Chainwit.",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:East_facade_Hawa_Mahal_Jaipur_from_ground_level_(July_2022)_-_img_01.jpg",
  },
  {
    file: "Nedumudy Houseboat",
    used: "Kerala trip cover and landing hero",
    author: "Ingo Mehling",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:Nedumudy_-_Houseboat.jpg",
  },
  {
    file: "Paddy Hills Inakanahalli, Coorg",
    used: "Coorg trip cover",
    author: "Timothy A. Gonsalves",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:Paddy_Hills_Inakanahalli_Coorg_Nov24_A7CR_04454.jpg",
  },
  {
    file: "Mountains, Manali, Himachal Pradesh",
    used: "Manali trip cover",
    author: "Shameer Thajudeen",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:Mountains,_Manali,_Himachal_Pradesh.jpg",
  },
];

export default function CreditsPage() {
  return (
    <div className="min-h-dvh bg-paper-50">
      <SiteHeader />
      <main id="main" className="page-container max-w-3xl py-12 sm:py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-ink-500 hover:text-forest-800"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Back to TripSync
        </Link>

        <p className="eyebrow mt-8">Attribution</p>
        <h1 className="display-heading mt-3 text-[34px] text-forest-900 sm:text-[40px]">
          Photo credits
        </h1>
        <p className="mt-4 text-[13.5px] leading-6 text-ink-500">
          The destination photographs in this project come from Wikimedia
          Commons. They are used under the licenses below, resized and cropped to
          fit the layout. No other alterations were made.
        </p>

        <ul className="mt-8 divide-y divide-line border-y border-line">
          {photos.map((photo) => (
            <li key={photo.source} className="py-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <div>
                  <p className="text-[13px] font-semibold text-forest-900">
                    {photo.file}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-ink-500">
                    {photo.author} · {photo.used}
                  </p>
                </div>
                <p className="shrink-0 text-[11px] text-ink-400">{photo.license}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px]">
                <a
                  href={photo.source}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 font-medium text-forest-800 underline decoration-line-strong underline-offset-4 hover:text-clay-700"
                >
                  Source
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
                <a
                  href={photo.licenseUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1 text-ink-500 underline decoration-line underline-offset-4 hover:text-forest-800"
                >
                  License
                  <ExternalLink aria-hidden="true" className="size-3" />
                </a>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-[11px] leading-5 text-ink-400">
          Destination names and trip details are fictional sample content. The
          photographs are illustrative and do not depict the specific sample
          itineraries.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
