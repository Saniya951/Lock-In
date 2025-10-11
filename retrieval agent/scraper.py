"""
scrape_docs.py
Scrapes React documentation and saves as markdown files
Run: python scrape_docs.py
"""

import requests
from bs4 import BeautifulSoup
import html2text
import os
import json
import time
from urllib.parse import urlparse
from pathlib import Path

# Configure html2text for clean markdown conversion
h = html2text.HTML2Text()
h.ignore_links = False
h.ignore_images = False
h.ignore_emphasis = False
h.body_width = 0  # Don't wrap lines
h.mark_code = True

# Key React documentation pages to scrape
DOCS_TO_SCRAPE = [
    'https://react.dev/reference/react/useState',
    'https://react.dev/reference/react/useEffect',
    'https://react.dev/reference/react/useContext',
    'https://react.dev/reference/react/useRef',
    'https://react.dev/reference/react/useMemo',
    'https://react.dev/reference/react/useCallback',
    'https://react.dev/learn/your-first-component',
    'https://react.dev/learn/passing-props-to-a-component',
    'https://react.dev/learn/conditional-rendering',
    'https://react.dev/learn/rendering-lists',
    'https://react.dev/learn/state-a-components-memory',
    'https://react.dev/learn/updating-objects-in-state',
    'https://react.dev/learn/updating-arrays-in-state',
]

def scrape_page(url):
    """
    Scrape a single page and convert to markdown
    
    Args:
        url (str): URL to scrape
        
    Returns:
        dict: Contains url, filename, markdown content, and title
    """
    try:
        print(f"Scraping: {url}")
        
        # Make request with headers to mimic a browser
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()  # Raise exception for bad status codes
        
        # Parse HTML with BeautifulSoup
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove unwanted elements (navigation, footer, etc.)
        for element in soup.find_all(['nav', 'footer', 'header']):
            element.decompose()
        
        for element in soup.find_all(class_=['sidebar', 'navigation']):
            element.decompose()
        
        # Extract main content
        # React docs typically use <article> or <main> tags
        content = soup.find('article') or soup.find('main') or soup.find(class_='content')
        
        if not content:
            content = soup.find('body')
        
        # Convert HTML to Markdown
        markdown = h.handle(str(content))
        
        # Generate filename from URL path
        parsed_url = urlparse(url)
        path_parts = [p for p in parsed_url.path.split('/') if p]
        filename = '_'.join(path_parts) + '.md'
        
        # Extract title
        title_tag = soup.find('h1')
        title = title_tag.get_text() if title_tag else filename
        
        return {
            'url': url,
            'filename': filename,
            'markdown': markdown,
            'title': title
        }
        
    except requests.RequestException as e:
        print(f" Error scraping {url}: {e}")
        return None
    except Exception as e:
        print(f" Unexpected error for {url}: {e}")
        return None

def scrape_all_docs():
    """
    Scrape all documentation pages and save to files
    """
    # Create output directory
    docs_dir = Path('react-docs')
    docs_dir.mkdir(exist_ok=True)
    
    results = []
    
    print(f"\n Starting to scrape {len(DOCS_TO_SCRAPE)} pages...\n")
    
    for url in DOCS_TO_SCRAPE:
        doc = scrape_page(url)
        
        if doc:
            # Save markdown to file
            filepath = docs_dir / doc['filename']
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(doc['markdown'])
            
            print(f"✓ Saved: {doc['filename']}")
            
            results.append({
                'url': doc['url'],
                'filename': doc['filename'],
                'title': doc['title']
            })
        
        # Be polite - wait between requests to avoid overloading server
        time.sleep(1)
    
    # Save index file
    index_path = docs_dir / 'index.json'
    with open(index_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    
    print(f"\n Scraped {len(results)} documents")
    print(f" Index saved to: {index_path}")
    print(f" Files saved in: {docs_dir}/")

if __name__ == '__main__':
    scrape_all_docs()