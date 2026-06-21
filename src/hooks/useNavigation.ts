import { useRouter } from 'expo-router';

export function useAppNavigation() {
  const router = useRouter();
  
  return {
    navigate: (path: string) => router.push(path as any),
    replace: (path: string) => router.replace(path as any),
    goBack: () => router.back(),
    push: (path: string, params?: any) => router.push({ pathname: path as any, params }),
  };
}