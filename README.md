## About

Managing pull requests is a pain. This project is a local Sinatra server you run on your machine to handle all the verification and merging of pull requests in your repositories. More information and instructions to come.

https://github.com/croby/github-pr-manager

## Getting Started

Prerequisites: ruby (tested on 1.9.2), rubygems

To run:

1. Copy config.yml.sample to config.yml and edit it to point to the correct places

```
'org' is your organization, or your username
'repo' is the repository you want to point to
'issues' tells the program to use Github's issues
'clone' points to your clone of the repository on your machine
'remote' is the upstream remote. Typically this will be 'origin'
'per_page' is how many issues per page you'd like to see
'auto_close' indicates if, when merging using a squash, you'd like the issue to be closed on github
```

2. Copy auth.yml.sample to auth.yml and add your github login information. This file is in .gitignore so you don't have to worry about accidentally checking it in.

3. `gem install bundler` to install bundler, if you don't already have it

4. `bundle install` to install the application dependencies

5. `rackup -p 4567` boots the server

6. Launch http://localhost:4567


## Credits

* Sinatra http://sinatrarb.com
* Twitter Bootstrap http://twitter.github.com/bootstrap/
* jQuery http://jquery.com
* Grit https://github.com/mojombo/grit
* RedCarpet https://github.com/tanoku/redcarpet
* Rails https://github.com/rails/rails
* Mustache https://github.com/defunkt/mustache
* CSS3 Loader http://www.alessioatzeni.com/blog/css3-loading-animation-loop/

## License

MIT Licensed. See LICENSE.txt
