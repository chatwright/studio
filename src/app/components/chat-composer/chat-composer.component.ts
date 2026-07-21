import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

export type ChatComposerPlatform = 'telegram' | 'whatsapp';

@Component({
  selector: 'cw-chat-composer',
  imports: [ButtonModule, InputTextModule],
  templateUrl: './chat-composer.component.html',
  styleUrl: './chat-composer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComposerComponent {
  readonly actor = input.required<string>();
  readonly platform = input.required<ChatComposerPlatform>();
  readonly placeholder = input<string>();
  readonly messageSent = output<string>();
  readonly draft = signal('');
  readonly composerInput = viewChild<ElementRef<HTMLInputElement>>('composerInput');

  updateDraft(event: Event): void {
    this.draft.set((event.target as HTMLInputElement).value);
  }

  send(): void {
    const text = this.draft().trim();
    if (!text) {
      return;
    }

    this.messageSent.emit(text);
    this.clear();
  }

  clear(): void {
    this.draft.set('');
    const inputElement = this.composerInput()?.nativeElement;
    if (inputElement) {
      inputElement.value = '';
    }
  }
}
