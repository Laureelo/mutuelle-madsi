import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DialogHostComponent } from './components/layout/dialog-host.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DialogHostComponent],
  template: `<router-outlet /><app-dialog-host />`,
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'frontend';
}
