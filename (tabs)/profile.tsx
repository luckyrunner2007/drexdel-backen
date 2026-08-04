import { HistoryVault } from '../../src/screens/Dashboard/HistoryVault';
import { OrganiserHub } from '../../src/screens/Dashboard/OrganiserHub';
import { useUser } from '../../src/state/UserContext';

export default function ProfileTab() {
  const { user } = useUser();
  
  // Show organizer hub for promoters, history vault for regular users
  if (user?.role === 'promoter_admin') {
    return <OrganiserHub />;
  }
  
  return <HistoryVault />;
}
