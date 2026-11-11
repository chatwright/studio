import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { studioMetadata } from './studio-metadata';

@Injectable()
export class StudioTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const metadata = studioMetadata(snapshot.url);
    this.title.setTitle(metadata.title);
    for (const name of ['description', 'robots'] as const) {
      this.meta.updateTag({ name, content: metadata[name] });
    }
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: 'Chatwright' });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary' });
    for (const field of ['title', 'description'] as const) {
      this.meta.updateTag({ property: `og:${field}`, content: metadata[field] });
      this.meta.updateTag({ name: `twitter:${field}`, content: metadata[field] });
    }
    this.meta.updateTag({ property: 'og:url', content: metadata.canonical });
    let canonical = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.rel = 'canonical';
      this.document.head.appendChild(canonical);
    }
    canonical.href = metadata.canonical;
  }
}
