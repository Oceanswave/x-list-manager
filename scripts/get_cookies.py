import browser_cookie3
import json
import sys

def get_cookies():
    cookies_list = []
    try:
        # Load cookies for .x.com and .twitter.com
        cj_x = browser_cookie3.chrome(domain_name='.x.com')
        cj_twitter = browser_cookie3.chrome(domain_name='.twitter.com')
        
        all_cookies = list(cj_x) + list(cj_twitter)
        
        # Deduplicate based on name and domain
        seen = set()
        
        for c in all_cookies:
            key = (c.name, c.domain)
            if key in seen:
                continue
            seen.add(key)
            
            # Helper to get httpOnly if available (some forks/versions might have it)
            http_only = False
            if hasattr(c, 'has_nonstandard_attr'):
                if c.has_nonstandard_attr('HttpOnly') or c.has_nonstandard_attr('httponly'):
                    http_only = True
            
            cookies_list.append({
                'name': c.name,
                'value': c.value,
                'domain': c.domain,
                'path': c.path,
                'secure': bool(c.secure),
                'expires': c.expires,
                'httpOnly': bool(http_only)
            })
            
    except Exception as e:
        # Print error to stderr so stdout only has JSON
        sys.stderr.write(str(e) + '\n')
        sys.exit(1)

    print(json.dumps(cookies_list))

if __name__ == "__main__":
    get_cookies()
