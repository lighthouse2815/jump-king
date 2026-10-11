import { useParams } from 'react-router-dom';
import { OriginalGamePage } from './OriginalGamePage';

export const RaceGamePage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  return <OriginalGamePage mode="race" roomId={roomId} />;
};
