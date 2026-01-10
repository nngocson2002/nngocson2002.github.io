(function() {
    'use strict';
    
    // 加载预先获取的 citation 数据
    async function loadCitations() {
        try {
            const response = await fetch('{{ "/_data/citations.json" | relative_url }}');
            if (!response.ok) {
                throw new Error('Failed to load citations');
            }
            
            const data = await response.json();
            console.log('Citation data loaded:', data);
            updateCitationBadges(data.citations);
            
        } catch (error) {
            console.warn('Could not load citation data:', error);
        }
    }
    
    // 更新所有 citation 徽章
    function updateCitationBadges(citations) {
        // 查找所有论文项
        const publicationItems = document.querySelectorAll('[data-paper-id]');
        
        publicationItems.forEach(item => {
            const paperId = item.getAttribute('data-paper-id');
            const citationData = citations[paperId];
            
            if (!citationData) {
                console.log(`No citation data for ${paperId}`);
                return;
            }
            
            // 查找插入位置
            let container = item.querySelector('.pub-list-item p, .publication-item p');
            if (!container) {
                container = item.querySelector('p');
            }
            
            if (!container) return;
            
            // 创建 citation 徽章
            const badge = document.createElement('span');
            badge.className = 'badge badge-pill badge-publication';
            
            if (citationData.citations !== null && citationData.citations !== undefined) {
                badge.classList.add('badge-info');
                badge.textContent = `Citations: ${citationData.citations}`;
                badge.title = `Cited ${citationData.citations} times (via ${citationData.source || 'unknown'})`;
            } else {
                badge.classList.add('badge-secondary');
                badge.textContent = 'Citations: N/A';
                badge.title = citationData.error || 'Citation data not available';
            }
            
            // 插入到容器末尾
            container.appendChild(document.createTextNode(' '));
            container.appendChild(badge);
        });
    }
    
    // 页面加载完成后执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadCitations);
    } else {
        loadCitations();
    }
})();