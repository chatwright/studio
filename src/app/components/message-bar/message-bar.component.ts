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
 * `'compare'` is Compare mode's own brand for the one shared message bar that
 * drives both platform panes at once — deliberately neither platform's own
 * color (it fans out to both), see message-bar.component.scss.
 */
export type MessageBarPlatform = 'telegram' | 'whatsapp' | 'compare';

@Component({
  selector: 'cw-message-bar',
  imports: [ButtonModule, InputTextModule],
  templateUrl: './message-bar.component.html',
  styleUrl: './message-bar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageBarComponent {
  readonly actor = input.required<string>();
  readonly platform = input.required<MessageBarPlatform>();
  readonly placeholder = input<string>();
  readonly messageSent = output<string>();
  readonly draft = signal('');
  readonly messageBarInput = viewChild<ElementRef<HTMLInputElement>>('messageBarInput');

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
    const inputElement = this.messageBarInput()?.nativeElement;
    if (inputElement) {
      inputElement.value = '';
    }
  }

  /** Moves keyboard focus into this message bar's text input — called on send (above) and by the owning pane once a conversation starts (see `ChatPaneComponent`/`PlaygroundPage`). */
  focus(): void {
    this.messageBarInput()?.nativeElement.focus();
  }
}
