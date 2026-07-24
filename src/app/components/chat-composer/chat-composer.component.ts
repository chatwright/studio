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

/**
 * `'compare'` is Compare mode's own brand for the one shared composer that
 * drives both platform panes at once — deliberately neither platform's own
 * color (it fans out to both), see chat-composer.component.scss.
 */
export type ChatComposerPlatform = 'telegram' | 'whatsapp' | 'compare';

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
    // Founder tweak: refocus after every send, so a rapid back-and-forth
    // never needs a re-click on the input between messages.
    this.focus();
  }

  clear(): void {
    this.draft.set('');
    const inputElement = this.composerInput()?.nativeElement;
    if (inputElement) {
      inputElement.value = '';
    }
  }

  /** Moves keyboard focus into this composer's text input — called on send (above) and by the owning pane once a conversation starts (see `ChatPaneComponent`/`PlaygroundPage`). */
  focus(): void {
    this.composerInput()?.nativeElement.focus();
  }
}
