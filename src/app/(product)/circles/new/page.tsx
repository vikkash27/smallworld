import { Suspense } from 'react';
import NewCircleFlow from '../../../../components/circles/NewCircleFlow';

export const metadata = { title: 'New circle · Small World' };

// useSearchParams() needs a Suspense boundary or the production build fails.
export default function NewCirclePage() {
  return (
    <Suspense fallback={null}>
      <NewCircleFlow />
    </Suspense>
  );
}
