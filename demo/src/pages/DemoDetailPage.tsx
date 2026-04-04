import { useParams } from 'react-router-dom';

export default function DemoDetailPage() {
  const { id } = useParams();
  return (
    <div className="p-8">
      <h1>Demo: {id}</h1>
    </div>
  );
}
