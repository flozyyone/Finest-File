import { Plus, X, FolderSync, Bookmark } from "lucide-react";
import { useI18n } from "../i18n";
import styles from "./TabBar.module.css";

export interface TabItem {
  id: string;
  path: string;
  title: string;
  history: string[];
  historyIndex: number;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onGroupTabs?: () => void;
  onOpenWorkspaces?: () => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onGroupTabs,
  onOpenWorkspaces,
}) => {
  const { dict } = useI18n();

  return (
    <div className={styles.tabBar}>
      <div className={styles.tabsContainer}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={`${styles.tab} ${isActive ? styles.activeTab : ""}`}
              onClick={() => onSelectTab(tab.id)}
              title={tab.path}
            >
              <span className={styles.tabTitle}>{tab.title || dict.nav.thisPc}</span>
              {tabs.length > 1 && (
                <button
                  className={styles.closeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title={`${dict.nav.closeTab} (Ctrl+W)`}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button
        className={styles.newTabBtn}
        onClick={onNewTab}
        title={`${dict.nav.newTab} (Ctrl+T)`}
      >
        <Plus size={15} />
      </button>

      {onGroupTabs && (
        <button
          className={styles.gruplaBtn}
          onClick={onGroupTabs}
          title={dict.operations.groupTabs}
        >
          <FolderSync size={13} />
          <span>{dict.operations.groupTabs}</span>
        </button>
      )}

      {onOpenWorkspaces && (
        <button
          className={styles.gruplaBtn}
          onClick={onOpenWorkspaces}
          title={dict.operations.workspaces}
        >
          <Bookmark size={13} />
          <span>{dict.operations.workspaces}</span>
        </button>
      )}
    </div>
  );
};
