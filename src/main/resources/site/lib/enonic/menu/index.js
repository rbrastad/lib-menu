var libs = {
    portal: require('/lib/xp/portal'),
    content: require('/lib/xp/content')
};

var globals = {
	appPath: app.name.replace(/\./g, '-')
};

/**
 * Returns the full breadcrumb menu path for the current content and site.
 * @param {Object} params - A JSON object containing the (optional) settings for the function.
 *   @param {Boolean} [params.linkActiveItem=false] - Wrap the active (current content) item with a link.
 *   @param {Boolean} [params.showHomepage=true] - Disable return of item for the site homepage.
 *   @param {String} [params.homepageTitle=null] - Customize (overwrite) the displayName of home/site link (if used). Common usage: "Home" or "Start".
 *   @param {String} [params.dividerHtml=null] - Any custom html you want appended to each item, except the last one. Common usage: '<span class="divider">/</span>'.
 * @returns {Object} - The set of breadcrumb menu items (as array) and needed settings.
 */
 exports.getBreadcrumbMenu = function(params) {
	var content = libs.portal.getContent();
	var site = libs.portal.getSite();
	var breadcrumbItems = []; // Stores each menu item
	var breadcrumbMenu = {}; // Stores the final JSON sent to Thymeleaf

	// Safely take care of all incoming settings and set defaults, for use in current scope only
	var settings = {
		linkActiveItem: params.linkActiveItem || false,
		showHomepage: params.showHomepage || true,
		homepageTitle: params.homepageTitle || null,
		dividerHtml: params.dividerHtml || null
	};

	// Loop the entire path for current content based on the slashes. Generate one JSON item node for each item.
	// If on frontpage, skip the path-loop
	if (content._path != site._path) {
		var fullPath = content._path;
		var arrVars = fullPath.split("/");
		var arrLength = arrVars.length;
		for (var i = 1; i < arrLength-1; i++) { // Skip first item - the site - since it is handled separately.
			var lastVar = arrVars.pop();
			if (lastVar != '') {
				var curItem = libs.content.get({ key: arrVars.join("/") + "/" + lastVar }); // Make sure item exists
				if (curItem) {
					var item = {};
					var curItemUrl = libs.portal.pageUrl({
						path: curItem._path,
						type: 'absolute'
					});
					item.text = curItem.displayName;
					if (content._path === curItem._path) { // Is current node active?
						item.active = true;
						if (settings.linkActiveItem) { // Respect setting for creating links for active item
							item.url = curItemUrl;
						}
					} else {
						item.active = false;
						item.url = curItemUrl;
					}
					breadcrumbItems.push(item);
				}
			}
		}
	}

	// Add Home button linking to site home, if wanted
	if (settings.showHomepage) {
		var homeUrl = libs.portal.pageUrl({
			path: site._path,
			type: 'absolute'
		});
		var item = {
			text: settings.homepageTitle || site.displayName, // Fallback to site displayName if no custom name given
			url: homeUrl,
			active: (content._path === site._path)
		};
		breadcrumbItems.push(item);
	}

	// Add divider html (if any) and reverse the menu item array
	breadcrumbMenu.divider = settings.dividerHtml || null;
	breadcrumbMenu.items = breadcrumbItems.reverse();

	return breadcrumbMenu;
};

/**
 * Get menu tree
 * @param {integer} levels - menu levels to get
 * @returns {Array}
 */
exports.getMenuTree = function(levels) {
    var menu = [];
    var site = libs.portal.getSite();
    levels = (isInt(levels) ? levels : 1);

    if (site) {
        menu = exports.getSubMenus(site, levels);
    }

    return menu;
};

/**
 * Returns submenus of a parent menuitem.
 * @param {Content} parentContent - content object obtained with 'portal.getContent', 'portal.getSite' or any 'content.*' commands
 * @param {Integer} levels - The number of submenus to retrieve
 * @return {Array} Array of submenus
 */
exports.getSubMenus = function(parentContent, levels) {
    var subMenus = [];

    if (parentContent.type === 'portal:site' && isMenuItem(parentContent)) {
        subMenus.push(menuItemToJson(parentContent, 0));
    }

    var children = libs.content.getChildren({
        key: parentContent._id,
        count: 200
    });

    levels--;

	var loopLength = children.hits.length;
	for (var i = 0; i < loopLength; i++) {
		var child = children.hits[i];
		if (isMenuItem(child)) {
			subMenus.push(menuItemToJson(child, levels));
		}
	}

	return subMenus;
};


/**
 * Checks if the content is a menu item.
 * @param {Content} content - content object obtained with 'portal.getContent', 'portal.getSite' or any 'content.*' commands
 * @return {Boolean} true if the content is marked as menu item
 */
function isMenuItem(content) {
    var extraData = content.x;
    if (!extraData) {
        return false;
    }
	
    globals.appPath = Object.keys(extraData);

    var extraDataModule = extraData[globals.appPath];
    if (!extraDataModule || !extraDataModule['menu-item']) {
        return false;
    }
    var menuItemMetadata = extraDataModule['menu-item'] || {};

    return menuItemMetadata['menuItem'];
}

/**
 * Returns JSON data for a menuitem.
 * @param {Content} content - content object obtained with 'portal.getContent', 'portal.getSite' or any 'content.*' commands
 * @param {Integer} levels - The number of submenus to retrieve
 * @return {Object} Menuitem JSON data
 */
function menuItemToJson(content, levels) {
    var subMenus = [];
    if (levels > 0) {
        subMenus = exports.getSubMenus(content, levels);
    }

	 var inPath = false;
	 var isActive = false;

	 var currentContent = libs.portal.getContent();

	 // Is the menuitem we are processing in the currently viewed content's path?
	 if ( content._path == currentContent._path.substring(0,content._path.length) ) {
		 inPath = true;
	 }

	 // Is the currently viewed content the current menuitem we are processing?
	 if ( content._path == currentContent._path ) {
		 isActive = true;
		 inPath = false; // Reset this so an menuitem isn't both in a path and active (makes no sense)
	 }

    var menuItem = content.x[globals.appPath]['menu-item'];

    return {
        displayName: content.displayName,
        menuName: menuItem.menuName && menuItem.menuName.length ? menuItem.menuName : null,
        path: content._path,
        name: content._name,
        id: content._id,
        hasChildren: subMenus.length > 0,
        inPath: inPath,
        isActive: isActive,
        newWindow: menuItem.newWindow ? menuItem.newWindow : false,
        type: content.type,
        children: subMenus
    };
}

/**
 * Check if value is integer
 * @param value
 * @returns {boolean}
 */
function isInt(value) {
    return !isNaN(value) &&
           parseInt(Number(value)) == value &&
           !isNaN(parseInt(value, 10));
}
