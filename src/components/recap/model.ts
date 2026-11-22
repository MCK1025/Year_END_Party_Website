import type { Dashboard } from "../../../supabase/functions/_shared/contracts";
import type { Album, Detail } from "../../../supabase/functions/_shared/recap";

export type Moment = Dashboard["recaps"][number];

export function albumOf(moment?: Moment): Album {
  return (
    moment?.album ?? {
      introduction: "",
      cover_path: null,
      fit: "contain",
      x: 50,
      y: 50,
      slides: moment?.asset_path
        ? [
            {
              id: moment.id,
              asset_path: moment.asset_path,
              title: "",
              description: moment.caption,
              date: "",
            },
          ]
        : [],
    }
  );
}

export function orderedMoments(rows: readonly Moment[]) {
  return [...rows].sort((a, b) => a.sort_order - b.sort_order || (a.album_order ?? 0) - (b.album_order ?? 0));
}

export interface AlbumPage {
  readonly id: string;
  readonly moment: Moment;
  readonly number: number;
  readonly photo: string | null;
  readonly detail?: Detail;
}

export function albumPages(rows: readonly Moment[]): AlbumPage[] {
  return orderedMoments(rows).flatMap((moment, index) => {
    const album = albumOf(moment);
    const number = index + 1;
    return [
      { id: moment.id, moment, number, photo: album.cover_path },
      ...album.slides.map((detail) => ({
        id: `${moment.id}/${detail.id}`,
        moment,
        number,
        photo: detail.asset_path,
        detail,
      })),
    ];
  });
}
