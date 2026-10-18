import React from "react";
import { Plus, X } from "lucide-react";
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
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
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
              <span className={styles.tabTitle}>{tab.title || "Home"}</span>
              {tabs.length > 1 && (
                <button
                  className={styles.closeBtn}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title="Close tab (Ctrl+W)"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button className={styles.newTabBtn} onClick={onNewTab} title="New tab (Ctrl+T)">
        <Plus size={15} />
      </button>
    </div>
  );
};
