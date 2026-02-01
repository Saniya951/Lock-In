# Configuration Handling¶

Applications need some kind of configuration. There are different settings you might want to change depending on the application environment like toggling the debug mode, setting the secret key, and other such environment-specific things.

The way Flask is designed usually requires the configuration to be available when the application starts up. You can hard code the configuration in the code, which for many small applications is not actually that bad, but there are better ways.

Independent of how you load your config, there is a config object available which holds the loaded configuration values: The [`config`](../api/#flask.Flask.config "flask.Flask.config") attribute of the [`Flask`](../api/#flask.Flask "flask.Flask") object. This is the place where Flask itself puts certain configuration values and also where extensions can put their configuration values. But this is also where you can have your own configuration.

## Configuration Basics¶

The [`config`](../api/#flask.Flask.config "flask.Flask.config") is actually a subclass of a dictionary and can be modified just like any dictionary:
[code] 
    app = Flask(__name__)
    app.config['TESTING'] = True
    
[/code]

Certain configuration values are also forwarded to the [`Flask`](../api/#flask.Flask "flask.Flask") object so you can read and write them from there:
[code] 
    app.testing = True
    
[/code]

To update multiple keys at once you can use the [`dict.update()`](https://docs.python.org/3/library/stdtypes.html#dict.update "\(in Python v3.13\)") method:
[code] 
    app.config.update(
        TESTING=True,
        SECRET_KEY='192b9bdd22ab9ed4d12e236c78afcb9a393ec15f71bbf5dc987d54727823bcbf'
    )
    
[/code]

## Debug Mode¶

The `DEBUG` config value is special because it may behave inconsistently if changed after the app has begun setting up. In order to set debug mode reliably, use the `--debug` option on the `flask` or `flask run` command. `flask run` will use the interactive debugger and reloader by default in debug mode.
[code] 
    $ flask --app hello run --debug
    
[/code]

Using the option is recommended. While it is possible to set `DEBUG` in your config or code, this is strongly discouraged. It can’t be read early by the `flask run` command, and some systems or extensions may have already configured themselves based on a previous value.

## Builtin Configuration Values¶

The following configuration values are used internally by Flask:

DEBUG¶
    

Whether debug mode is enabled. When using `flask run` to start the development server, an interactive debugger will be shown for unhandled exceptions, and the server will be reloaded when code changes. The [`debug`](../api/#flask.Flask.debug "flask.Flask.debug") attribute maps to this config key. This is set with the `FLASK_DEBUG` environment variable. It may not behave as expected if set in code.

**Do not enable debug mode when deploying in production.**

Default: `False`

TESTING¶
    

Enable testing mode. Exceptions are propagated rather than handled by the the app’s error handlers. Extensions may also change their behavior to facilitate easier testing. You should enable this in your own tests.

Default: `False`

PROPAGATE_EXCEPTIONS¶
    

Exceptions are re-raised rather than being handled by the app’s error handlers. If not set, this is implicitly true if `TESTING` or `DEBUG` is enabled.

Default: `None`

TRAP_HTTP_EXCEPTIONS¶
    

If there is no handler for an `HTTPException`-type exception, re-raise it to be handled by the interactive debugger instead of returning it as a simple error response.

Default: `False`

TRAP_BAD_REQUEST_ERRORS¶
    

Trying to access a key that doesn’t exist from request dicts like `args` and `form` will return a 400 Bad Request error page. Enable this to treat the error as an unhandled exception instead so that you get the interactive debugger. This is a more specific version of `TRAP_HTTP_EXCEPTIONS`. If unset, it is enabled in debug mode.

Default: `None`

SECRET_KEY¶
    

A secret key that will be used for securely signing the session cookie and can be used for any other security related needs by extensions or your application. It should be a long random `bytes` or `str`. For example, copy the output of this to your config:
[code] 
    $ python -c 'import secrets; print(secrets.token_hex())'
    '192b9bdd22ab9ed4d12e236c78afcb9a393ec15f71bbf5dc987d54727823bcbf'
    
[/code]

**Do not reveal the secret key when posting questions or committing code.**

Default: `None`

SECRET_KEY_FALLBACKS¶
    

A list of old secret keys that can still be used for unsigning. This allows a project to implement key rotation without invalidating active sessions or other recently-signed secrets.

Keys should be removed after an appropriate period of time, as checking each additional key adds some overhead.

Order should not matter, but the default implementation will test the last key in the list first, so it might make sense to order oldest to newest.

Flask’s built-in secure cookie session supports this. Extensions that use `SECRET_KEY` may not support this yet.

Default: `None`

Added in version 3.1.

SESSION_COOKIE_NAME¶
    

The name of the session cookie. Can be changed in case you already have a cookie with the same name.

Default: `'session'`

SESSION_COOKIE_DOMAIN¶
    

The value of the `Domain` parameter on the session cookie. If not set, browsers will only send the cookie to the exact domain it was set from. Otherwise, they will send it to any subdomain of the given value as well.

Not setting this value is more restricted and secure than setting it.

Default: `None`

Warning

If this is changed after the browser created a cookie is created with one setting, it may result in another being created. Browsers may send send both in an undefined order. In that case, you may want to change `SESSION_COOKIE_NAME` as well or otherwise invalidate old sessions.

Changelog

Changed in version 2.3: Not set by default, does not fall back to `SERVER_NAME`.

SESSION_COOKIE_PATH¶
    

The path that the session cookie will be valid for. If not set, the cookie will be valid underneath `APPLICATION_ROOT` or `/` if that is not set.

Default: `None`

SESSION_COOKIE_HTTPONLY¶
    

Browsers will not allow JavaScript access to cookies marked as “HTTP only” for security.

Default: `True`

SESSION_COOKIE_SECURE¶
    

Browsers will only send cookies with requests over HTTPS if the cookie is marked “secure”. The application must be served over HTTPS for this to make sense.

Default: `False`

SESSION_COOKIE_PARTITIONED¶
    

Browsers will send cookies based on the top-level document’s domain, rather than only the domain of the document setting the cookie. This prevents third party cookies set in iframes from “leaking” between separate sites.

Browsers are beginning to disallow non-partitioned third party cookies, so you need to mark your cookies partitioned if you expect them to work in such embedded situations.

Enabling this implicitly enables `SESSION_COOKIE_SECURE` as well, as it is only valid when served over HTTPS.

Default: `False`

Added in version 3.1.

SESSION_COOKIE_SAMESITE¶
    

Restrict how cookies are sent with requests from external sites. Can be set to `'Lax'` (recommended) or `'Strict'`. See [Set-Cookie options](../web-security/#security-cookie).

Default: `None`

Changelog

Added in version 1.0.

PERMANENT_SESSION_LIFETIME¶
    

If `session.permanent` is true, the cookie’s expiration will be set this number of seconds in the future. Can either be a [`datetime.timedelta`](https://docs.python.org/3/library/datetime.html#datetime.timedelta "\(in Python v3.13\)") or an `int`.

Flask’s default cookie implementation validates that the cryptographic signature is not older than this value.

Default: `timedelta(days=31)` (`2678400` seconds)

SESSION_REFRESH_EACH_REQUEST¶
    

Control whether the cookie is sent with every response when `session.permanent` is true. Sending the cookie every time (the default) can more reliably keep the session from expiring, but uses more bandwidth. Non-permanent sessions are not affected.

Default: `True`

USE_X_SENDFILE¶
    

When serving files, set the `X-Sendfile` header instead of serving the data with Flask. Some web servers, such as Apache, recognize this and serve the data more efficiently. This only makes sense when using such a server.

Default: `False`

SEND_FILE_MAX_AGE_DEFAULT¶
    

When serving files, set the cache control max age to this number of seconds. Can be a [`datetime.timedelta`](https://docs.python.org/3/library/datetime.html#datetime.timedelta "\(in Python v3.13\)") or an `int`. Override this value on a per-file basis using [`get_send_file_max_age()`](../api/#flask.Flask.get_send_file_max_age "flask.Flask.get_send_file_max_age") on the application or blueprint.

If `None`, `send_file` tells the browser to use conditional requests will be used instead of a timed cache, which is usually preferable.

Default: `None`

TRUSTED_HOSTS¶
    

Validate [`Request.host`](../api/#flask.Request.host "flask.Request.host") and other attributes that use it against these trusted values. Raise a [`SecurityError`](https://werkzeug.palletsprojects.com/en/stable/exceptions/#werkzeug.exceptions.SecurityError "\(in Werkzeug v3.1.x\)") if the host is invalid, which results in a 400 error. If it is `None`, all hosts are valid. Each value is either an exact match, or can start with a dot `.` to match any subdomain.

Validation is done during routing against this value. `before_request` and `after_request` callbacks will still be called.

Default: `None`

Added in version 3.1.

SERVER_NAME¶
    

Inform the application what host and port it is bound to.

Must be set if `subdomain_matching` is enabled, to be able to extract the subdomain from the request.

Must be set for `url_for` to generate external URLs outside of a request context.

Default: `None`

Changed in version 3.1: Does not restrict requests to only this domain, for both `subdomain_matching` and `host_matching`.

Changelog

Changed in version 2.3: Does not affect `SESSION_COOKIE_DOMAIN`.

Changed in version 1.0: Does not implicitly enable `subdomain_matching`.

APPLICATION_ROOT¶
    

Inform the application what path it is mounted under by the application / web server. This is used for generating URLs outside the context of a request (inside a request, the dispatcher is responsible for setting `SCRIPT_NAME` instead; see [Application Dispatching](../patterns/appdispatch/) for examples of dispatch configuration).

Will be used for the session cookie path if `SESSION_COOKIE_PATH` is not set.

Default: `'/'`

PREFERRED_URL_SCHEME¶
    

Use this scheme for generating external URLs when not in a request context.

Default: `'http'`

MAX_CONTENT_LENGTH¶
    

The maximum number of bytes that will be read during this request. If this limit is exceeded, a 413 [`RequestEntityTooLarge`](https://werkzeug.palletsprojects.com/en/stable/exceptions/#werkzeug.exceptions.RequestEntityTooLarge "\(in Werkzeug v3.1.x\)") error is raised. If it is set to `None`, no limit is enforced at the Flask application level. However, if it is `None` and the request has no `Content-Length` header and the WSGI server does not indicate that it terminates the stream, then no data is read to avoid an infinite stream.

Each request defaults to this config. It can be set on a specific [`Request.max_content_length`](../api/#flask.Request.max_content_length "flask.Request.max_content_length") to apply the limit to that specific view. This should be set appropriately based on an application’s or view’s specific needs.

Default: `None`

Changelog

Added in version 0.6.

MAX_FORM_MEMORY_SIZE¶
    

The maximum size in bytes any non-file form field may be in a `multipart/form-data` body. If this limit is exceeded, a 413 [`RequestEntityTooLarge`](https://werkzeug.palletsprojects.com/en/stable/exceptions/#werkzeug.exceptions.RequestEntityTooLarge "\(in Werkzeug v3.1.x\)") error is raised. If it is set to `None`, no limit is enforced at the Flask application level.

Each request defaults to this config. It can be set on a specific `Request.max_form_memory_parts` to apply the limit to that specific view. This should be set appropriately based on an application’s or view’s specific needs.

Default: `500_000`

Added in version 3.1.

MAX_FORM_PARTS¶
    

The maximum number of fields that may be present in a `multipart/form-data` body. If this limit is exceeded, a 413 [`RequestEntityTooLarge`](https://werkzeug.palletsprojects.com/en/stable/exceptions/#werkzeug.exceptions.RequestEntityTooLarge "\(in Werkzeug v3.1.x\)") error is raised. If it is set to `None`, no limit is enforced at the Flask application level.

Each request defaults to this config. It can be set on a specific [`Request.max_form_parts`](../api/#flask.Request.max_form_parts "flask.Request.max_form_parts") to apply the limit to that specific view. This should be set appropriately based on an application’s or view’s specific needs.

Default: `1_000`

Added in version 3.1.

TEMPLATES_AUTO_RELOAD¶
    

Reload templates when they are changed. If not set, it will be enabled in debug mode.

Default: `None`

EXPLAIN_TEMPLATE_LOADING¶
    

Log debugging information tracing how a template file was loaded. This can be useful to figure out why a template was not loaded or the wrong file appears to be loaded.

Default: `False`

MAX_COOKIE_SIZE¶
    

Warn if cookie headers are larger than this many bytes. Defaults to `4093`. Larger cookies may be silently ignored by browsers. Set to `0` to disable the warning.

PROVIDE_AUTOMATIC_OPTIONS¶
    

Set to `False` to disable the automatic addition of OPTIONS responses. This can be overridden per route by altering the `provide_automatic_options` attribute.

Added in version 3.10: Added `PROVIDE_AUTOMATIC_OPTIONS` to control the default addition of autogenerated OPTIONS responses.

Changelog

Changed in version 2.3: `JSON_AS_ASCII`, `JSON_SORT_KEYS`, `JSONIFY_MIMETYPE`, and `JSONIFY_PRETTYPRINT_REGULAR` were removed. The default `app.json` provider has equivalent attributes instead.

Changed in version 2.3: `ENV` was removed.

Changed in version 2.2: Removed `PRESERVE_CONTEXT_ON_EXCEPTION`.

Changed in version 1.0: `LOGGER_NAME` and `LOGGER_HANDLER_POLICY` were removed. See [Logging](../logging/) for information about configuration.

Added `ENV` to reflect the `FLASK_ENV` environment variable.

Added `SESSION_COOKIE_SAMESITE` to control the session cookie’s `SameSite` option.

Added `MAX_COOKIE_SIZE` to control a warning from Werkzeug.

Added in version 0.11: `SESSION_REFRESH_EACH_REQUEST`, `TEMPLATES_AUTO_RELOAD`, `LOGGER_HANDLER_POLICY`, `EXPLAIN_TEMPLATE_LOADING`

Added in version 0.10: `JSON_AS_ASCII`, `JSON_SORT_KEYS`, `JSONIFY_PRETTYPRINT_REGULAR`

Added in version 0.9: `PREFERRED_URL_SCHEME`

Added in version 0.8: `TRAP_BAD_REQUEST_ERRORS`, `TRAP_HTTP_EXCEPTIONS`, `APPLICATION_ROOT`, `SESSION_COOKIE_DOMAIN`, `SESSION_COOKIE_PATH`, `SESSION_COOKIE_HTTPONLY`, `SESSION_COOKIE_SECURE`

Added in version 0.7: `PROPAGATE_EXCEPTIONS`, `PRESERVE_CONTEXT_ON_EXCEPTION`

Added in version 0.6: `MAX_CONTENT_LENGTH`

Added in version 0.5: `SERVER_NAME`

Added in version 0.4: `LOGGER_NAME`

## Configuring from Python Files¶

Configuration becomes more useful if you can store it in a separate file, ideally located outside the actual application package. You can deploy your application, then separately configure it for the specific deployment.

A common pattern is this:
[code] 
    app = Flask(__name__)
    app.config.from_object('yourapplication.default_settings')
    app.config.from_envvar('YOURAPPLICATION_SETTINGS')
    
[/code]

This first loads the configuration from the `yourapplication.default_settings` module and then overrides the values with the contents of the file the `YOURAPPLICATION_SETTINGS` environment variable points to. This environment variable can be set in the shell before starting the server:

BashFishCMDPowershell
[code]
    $ export YOURAPPLICATION_SETTINGS=/path/to/settings.cfg
    $ flask run
     * Running on http://127.0.0.1:5000/
    
[/code]
[code] 
    $ set -x YOURAPPLICATION_SETTINGS /path/to/settings.cfg
    $ flask run
     * Running on http://127.0.0.1:5000/
    
[/code]
[code] 
    > set YOURAPPLICATION_SETTINGS=\path\to\settings.cfg
    > flask run
     * Running on http://127.0.0.1:5000/
    
[/code]
[code] 
    > $env:YOURAPPLICATION_SETTINGS = "\path\to\settings.cfg"
    > flask run
     * Running on http://127.0.0.1:5000/
    
[/code]

The configuration files themselves are actual Python files. Only values in uppercase are actually stored in the config object later on. So make sure to use uppercase letters for your config keys.

Here is an example of a configuration file:
[code] 
    # Example configuration
    SECRET_KEY = '192b9bdd22ab9ed4d12e236c78afcb9a393ec15f71bbf5dc987d54727823bcbf'
    
[/code]

Make sure to load the configuration very early on, so that extensions have the ability to access the configuration when starting up. There are other methods on the config object as well to load from individual files. For a complete reference, read the [`Config`](../api/#flask.Config "flask.Config") object’s documentation.

## Configuring from Data Files¶

It is also possible to load configuration from a file in a format of your choice using [`from_file()`](../api/#flask.Config.from_file "flask.Config.from_file"). For example to load from a TOML file:
[code] 
    import tomllib
    app.config.from_file("config.toml", load=tomllib.load, text=False)
    
[/code]

Or from a JSON file:
[code] 
    import json
    app.config.from_file("config.json", load=json.load)
    
[/code]

## Configuring from Environment Variables¶

In addition to pointing to configuration files using environment variables, you may find it useful (or necessary) to control your configuration values directly from the environment. Flask can be instructed to load all environment variables starting with a specific prefix into the config using [`from_prefixed_env()`](../api/#flask.Config.from_prefixed_env "flask.Config.from_prefixed_env").

Environment variables can be set in the shell before starting the server:

BashFishCMDPowershell
[code]
    $ export FLASK_SECRET_KEY="5f352379324c22463451387a0aec5d2f"
    $ export FLASK_MAIL_ENABLED=false
    $ flask run
     * Running on http://127.0.0.1:5000/
    
[/code]
[code] 
    $ set -x FLASK_SECRET_KEY "5f352379324c22463451387a0aec5d2f"
    $ set -x FLASK_MAIL_ENABLED false
    $ flask run
     * Running on http://127.0.0.1:5000/
    
[/code]
[code] 
    > set FLASK_SECRET_KEY="5f352379324c22463451387a0aec5d2f"
    > set FLASK_MAIL_ENABLED=false
    > flask run
     * Running on http://127.0.0.1:5000/
    
[/code]
[code] 
    > $env:FLASK_SECRET_KEY = "5f352379324c22463451387a0aec5d2f"
    > $env:FLASK_MAIL_ENABLED = "false"
    > flask run
     * Running on http://127.0.0.1:5000/
    
[/code]

The variables can then be loaded and accessed via the config with a key equal to the environment variable name without the prefix i.e.
[code] 
    app.config.from_prefixed_env()
    app.config["SECRET_KEY"]  # Is "5f352379324c22463451387a0aec5d2f"
    
[/code]

The prefix is `FLASK_` by default. This is configurable via the `prefix` argument of [`from_prefixed_env()`](../api/#flask.Config.from_prefixed_env "flask.Config.from_prefixed_env").

Values will be parsed to attempt to convert them to a more specific type than strings. By default [`json.loads()`](https://docs.python.org/3/library/json.html#json.loads "\(in Python v3.13\)") is used, so any valid JSON value is possible, including lists and dicts. This is configurable via the `loads` argument of [`from_prefixed_env()`](../api/#flask.Config.from_prefixed_env "flask.Config.from_prefixed_env").

When adding a boolean value with the default JSON parsing, only “true” and “false”, lowercase, are valid values. Keep in mind that any non-empty string is considered `True` by Python.

It is possible to set keys in nested dictionaries by separating the keys with double underscore (`__`). Any intermediate keys that don’t exist on the parent dict will be initialized to an empty dict.
[code] 
    $ export FLASK_MYAPI__credentials__username=user123
    
[/code]
[code] 
    app.config["MYAPI"]["credentials"]["username"]  # Is "user123"
    
[/code]

On Windows, environment variable keys are always uppercase, therefore the above example would end up as `MYAPI__CREDENTIALS__USERNAME`.

For even more config loading features, including merging and case-insensitive Windows support, try a dedicated library such as [Dynaconf](https://www.dynaconf.com/), which includes integration with Flask.

## Configuration Best Practices¶

The downside with the approach mentioned earlier is that it makes testing a little harder. There is no single 100% solution for this problem in general, but there are a couple of things you can keep in mind to improve that experience:

  1. Create your application in a function and register blueprints on it. That way you can create multiple instances of your application with different configurations attached which makes unit testing a lot easier. You can use this to pass in configuration as needed.

  2. Do not write code that needs the configuration at import time. If you limit yourself to request-only accesses to the configuration you can reconfigure the object later on as needed.

  3. Make sure to load the configuration very early on, so that extensions can access the configuration when calling `init_app`.




## Development / Production¶

Most applications need more than one configuration. There should be at least separate configurations for the production server and the one used during development. The easiest way to handle this is to use a default configuration that is always loaded and part of the version control, and a separate configuration that overrides the values as necessary as mentioned in the example above:
[code] 
    app = Flask(__name__)
    app.config.from_object('yourapplication.default_settings')
    app.config.from_envvar('YOURAPPLICATION_SETTINGS')
    
[/code]

Then you just have to add a separate `config.py` file and export `YOURAPPLICATION_SETTINGS=/path/to/config.py` and you are done. However there are alternative ways as well. For example you could use imports or subclassing.

What is very popular in the Django world is to make the import explicit in the config file by adding `from yourapplication.default_settings import *` to the top of the file and then overriding the changes by hand. You could also inspect an environment variable like `YOURAPPLICATION_MODE` and set that to `production`, `development` etc and import different hard-coded files based on that.

An interesting pattern is also to use classes and inheritance for configuration:
[code] 
    class Config(object):
        TESTING = False
    
    class ProductionConfig(Config):
        DATABASE_URI = 'mysql://user@localhost/foo'
    
    class DevelopmentConfig(Config):
        DATABASE_URI = "sqlite:////tmp/foo.db"
    
    class TestingConfig(Config):
        DATABASE_URI = 'sqlite:///:memory:'
        TESTING = True
    
[/code]

To enable such a config you just have to call into [`from_object()`](../api/#flask.Config.from_object "flask.Config.from_object"):
[code] 
    app.config.from_object('configmodule.ProductionConfig')
    
[/code]

Note that [`from_object()`](../api/#flask.Config.from_object "flask.Config.from_object") does not instantiate the class object. If you need to instantiate the class, such as to access a property, then you must do so before calling [`from_object()`](../api/#flask.Config.from_object "flask.Config.from_object"):
[code] 
    from configmodule import ProductionConfig
    app.config.from_object(ProductionConfig())
    
    # Alternatively, import via string:
    from werkzeug.utils import import_string
    cfg = import_string('configmodule.ProductionConfig')()
    app.config.from_object(cfg)
    
[/code]

Instantiating the configuration object allows you to use `@property` in your configuration classes:
[code] 
    class Config(object):
        """Base config, uses staging database server."""
        TESTING = False
        DB_SERVER = '192.168.1.56'
    
        @property
        def DATABASE_URI(self):  # Note: all caps
            return f"mysql://user@{self.DB_SERVER}/foo"
    
    class ProductionConfig(Config):
        """Uses production database server."""
        DB_SERVER = '192.168.19.32'
    
    class DevelopmentConfig(Config):
        DB_SERVER = 'localhost'
    
    class TestingConfig(Config):
        DB_SERVER = 'localhost'
        DATABASE_URI = 'sqlite:///:memory:'
    
[/code]

There are many different ways and it’s up to you how you want to manage your configuration files. However here a list of good recommendations:

  * Keep a default configuration in version control. Either populate the config with this default configuration or import it in your own configuration files before overriding values.

  * Use an environment variable to switch between the configurations. This can be done from outside the Python interpreter and makes development and deployment much easier because you can quickly and easily switch between different configs without having to touch the code at all. If you are working often on different projects you can even create your own script for sourcing that activates a virtualenv and exports the development configuration for you.

  * Use a tool like [fabric](https://www.fabfile.org/) to push code and configuration separately to the production server(s).




## Instance Folders¶

Changelog

Added in version 0.8.

Flask 0.8 introduces instance folders. Flask for a long time made it possible to refer to paths relative to the application’s folder directly (via `Flask.root_path`). This was also how many developers loaded configurations stored next to the application. Unfortunately however this only works well if applications are not packages in which case the root path refers to the contents of the package.

With Flask 0.8 a new attribute was introduced: `Flask.instance_path`. It refers to a new concept called the “instance folder”. The instance folder is designed to not be under version control and be deployment specific. It’s the perfect place to drop things that either change at runtime or configuration files.

You can either explicitly provide the path of the instance folder when creating the Flask application or you can let Flask autodetect the instance folder. For explicit configuration use the `instance_path` parameter:
[code] 
    app = Flask(__name__, instance_path='/path/to/instance/folder')
    
[/code]

Please keep in mind that this path _must_ be absolute when provided.

If the `instance_path` parameter is not provided the following default locations are used:

  * Uninstalled module:
[code] /myapp.py
        /instance
        
[/code]

  * Uninstalled package:
[code] /myapp
            /__init__.py
        /instance
        
[/code]

  * Installed module or package:
[code] $PREFIX/lib/pythonX.Y/site-packages/myapp
        $PREFIX/var/myapp-instance
        
[/code]

`$PREFIX` is the prefix of your Python installation. This can be `/usr` or the path to your virtualenv. You can print the value of `sys.prefix` to see what the prefix is set to.




Since the config object provided loading of configuration files from relative filenames we made it possible to change the loading via filenames to be relative to the instance path if wanted. The behavior of relative paths in config files can be flipped between “relative to the application root” (the default) to “relative to instance folder” via the `instance_relative_config` switch to the application constructor:
[code] 
    app = Flask(__name__, instance_relative_config=True)
    
[/code]

Here is a full example of how to configure Flask to preload the config from a module and then override the config from a file in the instance folder if it exists:
[code] 
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object('yourapplication.default_settings')
    app.config.from_pyfile('application.cfg', silent=True)
    
[/code]

The path to the instance folder can be found via the `Flask.instance_path`. Flask also provides a shortcut to open a file from the instance folder with `Flask.open_instance_resource()`.

Example usage for both:
[code] 
    filename = os.path.join(app.instance_path, 'application.cfg')
    with open(filename) as f:
        config = f.read()
    
    # or via open_instance_resource:
    with app.open_instance_resource('application.cfg') as f:
        config = f.read()
    
[/code]
