from flask_assets import Bundle, Environment

def init_assets(app):
    assets = Environment(app)
    
    # CSS Bundle
    css_inventory = Bundle(
        'css/dashboard_critical.css',
        'css/dashboard_inventory.css',
        filters='cssmin',
        output='gen/inventory.min.css'
    )
    
    # JS Bundle
    js_inventory = Bundle(
        'js/inventory_3d.js',
        'js/dashboard_inventory.js',
        filters='jsmin',
        output='gen/inventory.min.js'
    )
    
    assets.register('css_inventory', css_inventory)
    assets.register('js_inventory', js_inventory)
    
    return assets