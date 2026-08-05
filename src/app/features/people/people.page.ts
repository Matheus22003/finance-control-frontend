import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { PersonResponse } from '../../core/api/api.models';
import { FinanceControlApiService } from '../../core/api/finance-control-api.service';

@Component({
  selector: 'app-people-page',
  templateUrl: './people.page.html',
  styleUrl: './people.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PeoplePage {
  private readonly api = inject(FinanceControlApiService);

  protected readonly people = signal<PersonResponse[]>([]);
  protected readonly search = signal('');
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly filteredPeople = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('pt-BR');
    return this.people().filter(
      (person) =>
        !query ||
        person.name.toLocaleLowerCase('pt-BR').includes(query) ||
        person.email?.toLocaleLowerCase('pt-BR').includes(query),
    );
  });

  constructor() {
    this.loadPeople();
  }

  protected loadPeople(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.api
      .getPeople()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (people) => this.people.set(people),
        error: () => this.hasError.set(true),
      });
  }
}
