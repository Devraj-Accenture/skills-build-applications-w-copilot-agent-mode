import { CapabilityCard } from './CapabilityCard.js';
import { useEffect, useState } from 'react';
import { getJson } from '../api/client.js';

type Workout = {
  _id?: string;
  title: string;
  reason?: string;
  focus?: string;
  minutes?: number;
};

export default function Workouts() {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getJson<{ suggestions: Workout[] }>('/api/workouts/suggestions/mona@example.com')
      .then(({ suggestions }) => {
        if (active) setWorkouts(suggestions);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Unknown error');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="card h-100">
      <div className="card-body">
        <h2 className="h4">Workout suggestions</h2>
        <p>Recommend workouts from activity patterns.</p>
        {error ? (
          <p role="alert">Unable to load workout suggestions: {error}</p>
        ) : workouts === null ? (
          <p role="status">Loading workout suggestions...</p>
        ) : workouts.length === 0 ? (
          <p>No workout suggestions yet.</p>
        ) : (
          <ul>
            {workouts.map((workout, index) => (
              <li key={workout._id ?? `${workout.title}-${index}`}>
                <strong>{workout.title}</strong>
                {workout.focus ? ` - ${workout.focus}` : ''}
                {workout.minutes !== undefined ? `, ${workout.minutes} minutes` : ''}
                {workout.reason ? <p>{workout.reason}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}