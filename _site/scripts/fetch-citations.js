const fs = require('fs');
const https = require('https');
const path = require('path');

const OUTPUT_FILE = '_data/publications.json';
const PUBLICATIONS_DIR = '_publications';

// 正确读取 API Key
const API_KEY = process.env.SEMANTIC_SCHOLAR_API_KEY || '';

// 延迟函数
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// 从 Markdown 文件读取 front matter
function readFrontMatter(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    
    if (!match) return null;
    
    const frontMatter = {};
    const lines = match[1].split('\n');
    
    for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) continue;
        
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();
        
        // 移除引号
        value = value.replace(/^["']|["']$/g, '');
        
        frontMatter[key] = value;
    }
    
    return frontMatter;
}

// 递归获取所有出版物文件
function getAllPublications() {
    console.log('=== Directory Check ===');
    console.log('Current working directory:', process.cwd());
    console.log('Looking for:', PUBLICATIONS_DIR);
    console.log('Absolute path:', path.resolve(PUBLICATIONS_DIR));
    console.log('Directory exists?', fs.existsSync(PUBLICATIONS_DIR));
    
    if (!fs.existsSync(PUBLICATIONS_DIR)) {
        console.error(`Directory not found: ${PUBLICATIONS_DIR}`);
        
        // 尝试列出当前目录内容
        console.log('\n=== Current directory contents ===');
        try {
            const items = fs.readdirSync('.');
            items.forEach(item => {
                const stat = fs.statSync(item);
                console.log(`  ${stat.isDirectory() ? '[DIR]' : '[FILE]'} ${item}`);
            });
        } catch (e) {
            console.error('Error reading directory:', e.message);
        }
        
        return [];
    }
    
    const files = [];
    
    // 递归查找所有 .md 文件
    function findMarkdownFiles(dir) {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                // 递归进入子目录
                findMarkdownFiles(fullPath);
            } else if (item.endsWith('.md')) {
                files.push(fullPath);
            }
        }
    }
    
    findMarkdownFiles(PUBLICATIONS_DIR);
    
    // 按文件名排序（最新的在前）
    files.sort().reverse();
    
    console.log('Found files:');
    files.forEach(f => console.log(`  - ${f}`));
    
    return files.map(filePath => {
        const frontMatter = readFrontMatter(filePath);
        const fileName = path.basename(filePath, '.md');
        
        return {
            id: fileName,
            file: filePath,
            ...frontMatter
        };
    });
}

// 使用 Semantic Scholar API 通过 arXiv ID 获取
function fetchByArxiv(arxivId) {
    return new Promise((resolve, reject) => {
        const cleanArxivId = arxivId.replace('arXiv:', '').trim();
        const url = `https://api.semanticscholar.org/graph/v1/paper/arXiv:${encodeURIComponent(cleanArxivId)}?fields=citationCount,title,paperId,externalIds`;
        
        console.log(`  Searching by arXiv ID: ${cleanArxivId}`);
        
        const headers = {
            'User-Agent': 'Academic-Website-Citation-Bot',
            'Accept': 'application/json'
        };
        
        if (API_KEY && API_KEY.length > 0) {
            headers['x-api-key'] = API_KEY;
        }
        
        const options = { headers };
        
        https.get(url, options, (res) => {
            let data = '';
            
            res.on('data', chunk => data += chunk);
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (error) {
                        reject(new Error(`Parse error: ${error.message}`));
                    }
                } else if (res.statusCode === 404) {
                    resolve(null);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// 使用 Semantic Scholar API 通过 DOI 获取
function fetchByDOI(doi) {
    return new Promise((resolve, reject) => {
        const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(doi)}?fields=citationCount,title,paperId,externalIds`;
        
        console.log(`  Searching by DOI: ${doi}`);
        
        const headers = {
            'User-Agent': 'Academic-Website-Citation-Bot',
            'Accept': 'application/json'
        };
        
        if (API_KEY && API_KEY.length > 0) {
            headers['x-api-key'] = API_KEY;
        }
        
        const options = { headers };
        
        https.get(url, options, (res) => {
            let data = '';
            
            res.on('data', chunk => data += chunk);
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (error) {
                        reject(new Error(`Parse error: ${error.message}`));
                    }
                } else if (res.statusCode === 404) {
                    resolve(null);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// 使用 Semantic Scholar API 通过标题搜索
function fetchByTitle(title) {
    return new Promise((resolve, reject) => {
        const searchQuery = encodeURIComponent(title);
        const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${searchQuery}&fields=citationCount,title,paperId,externalIds&limit=5`;
        
        console.log(`  Searching by title: ${title.substring(0, 60)}...`);
        
        const headers = {
            'User-Agent': 'Academic-Website-Citation-Bot',
            'Accept': 'application/json'
        };
        
        if (API_KEY && API_KEY.length > 0) {
            headers['x-api-key'] = API_KEY;
        }
        
        const options = { headers };
        
        https.get(url, options, (res) => {
            let data = '';
            
            res.on('data', chunk => data += chunk);
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        
                        if (json.data && json.data.length > 0) {
                            resolve(json.data[0]);
                        } else {
                            resolve(null);
                        }
                    } catch (error) {
                        reject(new Error(`Parse error: ${error.message}`));
                    }
                } else if (res.statusCode === 429) {
                    reject(new Error('Rate limit exceeded'));
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

// 获取单篇论文的引用数据（带重试）
async function getCitationData(publication, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            // 优先使用 DOI
            if (publication.doi) {
                const data = await fetchByDOI(publication.doi);
                if (data) return data;
            }
            
            // 尝试 arXiv ID
            if (publication.arxiv) {
                const data = await fetchByArxiv(publication.arxiv);
                if (data) return data;
            }
            
            // 最后使用标题搜索
            if (publication.title) {
                const data = await fetchByTitle(publication.title);
                if (data) return data;
            }
            
            return null;
            
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries) {
                const waitTime = attempt * 2;
                console.log(`  ⚠ Error: ${error.message}, retrying... (${maxRetries - attempt} left)`);
                await delay(waitTime * 1000);
            }
        }
    }
    
    console.log(`  ✗ Failed after retries: ${lastError?.message || 'Unknown error'}`);
    return null;
}

// 主函数
async function main() {
    try {
        console.log('=== Starting Publication Data Generation ===\n');
        
        if (API_KEY && API_KEY.length > 0) {
            console.log('✓ Using Semantic Scholar API Key (authenticated)\n');
        } else {
            console.log('⚠ No API Key found, using public API (rate limited)\n');
        }
        
        const publications = getAllPublications();
        
        if (publications.length === 0) {
            console.log('No publications found!');
            console.log(`Searched in: ${PUBLICATIONS_DIR}`);
            return;
        }
        
        console.log(`\nFound ${publications.length} publications\n`);
        
        const results = {
            generated_at: new Date().toISOString(),
            total_citations: 0,
            papers: []
        };
        
        let successCount = 0;
        let notFoundCount = 0;
        
        for (let i = 0; i < publications.length; i++) {
            const pub = publications[i];
            console.log(`[${i + 1}/${publications.length}] Processing: ${pub.id}`);
            
            const citationData = await getCitationData(pub);
            
            const paperData = {
                id: pub.id,
                title: pub.title || 'Untitled',
                citations: citationData ? citationData.citationCount : null,
                semantic_scholar: citationData ? {
                    paper_id: citationData.paperId,
                    external_ids: citationData.externalIds || {}
                } : null
            };
            
            results.papers.push(paperData);
            
            if (citationData) {
                results.total_citations += citationData.citationCount || 0;
                successCount++;
                console.log(`  ✓ Found: ${citationData.citationCount || 0} citations`);
            } else {
                notFoundCount++;
                console.log(`  ✗ Not found`);
            }
            
            // 等待，避免速率限制
            if (i < publications.length - 1) {
                const waitTime = API_KEY && API_KEY.length > 0 ? 1 : 3;
                console.log(`  Waiting ${waitTime} seconds...\n`);
                await delay(waitTime * 1000);
            }
        }
        
        // 确保目录存在
        const outputDir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        
        // 写入结果
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        
        console.log('\n=== Summary ===');
        console.log(`Output: ${OUTPUT_FILE}`);
        console.log(`Total papers: ${publications.length}`);
        console.log(`Total citations: ${results.total_citations}`);
        console.log(`Papers with citations: ${successCount}`);
        console.log(`Papers not found: ${notFoundCount}`);
        
        console.log('\nCitation details:');
        results.papers.forEach(p => {
            console.log(`  ${p.id}: ${p.citations !== null ? p.citations : 'N/A'} citations`);
        });
        
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

main();