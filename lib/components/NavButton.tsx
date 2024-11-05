type Props = {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  children: React.ReactNode;
  tabKey: string;
};

export default function NavButton({ tabKey, activeTab, setActiveTab, children }: Props) {
  return (
    <button 
          className={`px-4 py-2 border-b-2 ${
            activeTab === tabKey 
              ? 'border-blue-500 text-blue-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
          onClick={() => setActiveTab(tabKey)}
    >
      {children}
    </button>
  );
}