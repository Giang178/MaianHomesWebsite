export interface ProjectCardImageSource {
  hero_images?: string[];
  images?: string[];
  logo_url?: string;
}

const firstUsableImage = (images?: string[]) =>
  images?.find((image) => typeof image === 'string' && image.trim().length > 0);

export function selectProjectCardImage(project: ProjectCardImageSource): string | undefined {
  return firstUsableImage(project.hero_images)
    || firstUsableImage(project.images)
    || (project.logo_url?.trim() || undefined);
}
