#!/usr/bin/env ruby

require "bundler/setup"
Bundler.require(:default)
require "yaml"
require "net/http"
require "sinatra/base"
require "mustache/sinatra"
require "cgi"
require "time"
require_relative "./lib/helpers.rb"

# Usage: Templates.template_to_render({:arg => val})
class Templates < Mustache
  def self.method_missing(method, *args, &block)
    self.template_file = "./templates/#{method}.mustache"
    if File.exists? self.template_file
      templ = self.new
      if args.size
        args[0].each do |k,v|
          templ[k.to_sym] = v
        end
      end
      templ.render
    end
  end
end

class GithubPRManager < Sinatra::Base
  include ActionView::Helpers::DateHelper

  CONFIG = YAML.load_file("config/config.yml")
  AUTH = YAML.load_file("config/auth.yml")
  PER_PAGE = "#{CONFIG["app"]["per_page"]}"
  ORG_TITLE = "#{CONFIG["repo"]["org"]}"
  REPO_TITLE = "#{CONFIG["repo"]["repo"]}"
  $md_processor = Redcarpet::Markdown.new(Redcarpet::Render::HTML.new(:hard_wrap => true), :autolink => true, :space_after_headers => true)

  def do_request(uri, parse, method = "GET", args = {})
    uri = URI(uri)

    case method
    when "POST"
      req = Net::HTTP::Post.new(uri.request_uri)
    when "PATCH"
      req = Net::HTTP::Post.new(uri.request_uri)
    else
      req = Net::HTTP::Get.new(uri.request_uri)
    end

    if not args.empty?
      req.body = args.to_json
    end

    req.basic_auth AUTH["user"], AUTH["pw"]

    http = Net::HTTP.new(uri.host, uri.port)
    if uri.scheme.eql? "https"
      http.use_ssl = true
    end
    res = http.start do |http| http.request(req) end
    if parse
      res = JSON.parse(res.body)
    else
      res = res.body
    end
    res
  end

  def get_pull_requests(page)
    page = page || 0
    pull_requests = do_request("https://api.github.com/repos/#{CONFIG["repo"]["org"]}/#{CONFIG["repo"]["repo"]}/pulls?page=#{page}&per_page=#{PER_PAGE}", true)
    if CONFIG["repo"]["issues"]
      ret = []
      assignees = []
      labels = []
      # No way to grab just issues that have a pull request at this time, so we have to either
      # do it this way, or issue one request per pull request to get it's associated issue
      issues = do_request("https://api.github.com/repos/#{CONFIG["repo"]["org"]}/#{CONFIG["repo"]["repo"]}/issues?per_page=3000", true)
      pull_requests.each do |pr|
        found_issue = false
        issues.each do |issue|
          if (issue["number"].eql? pr["number"])
            found_issue = true
            ret.push(pr.merge(issue))
            if issue["assignee"]
              assignees.push(issue["assignee"]).uniq!
            end
          end
        end
        if not found_issue
          ret.push(pr)
        end
      end
      {:pull_requests => ret, :assignees => assignees, :labels => labels}
    else
      {:pull_requests => pull_requests}
    end
  end

  def get_repo_status
    args = {:clone => CONFIG["local"]["clone"]}
    st = `#{Templates.status(args)}`
    current_branch = st.split("\n")[0][3..-1].split("...")[0]
    modified_files = st.split("\n")[1..-1].join("\n")
    [current_branch, modified_files]
  end

  def reset_to_master(force)
    args = {
      :clone => CONFIG["local"]["clone"]
    }
    if force
      args[:force] = "-f"
    end
    `#{Templates.reset_to_master(args)}`
  end

  def get_pull_req(pull_req_id)
    do_request("https://api.github.com/repos/#{CONFIG["repo"]["org"]}/#{CONFIG["repo"]["repo"]}/pulls/#{pull_req_id}", true)
  end

  def get_commits_between(pr)
    repo = Grit::Repo.new("#{CONFIG["local"]["clone"]}")
    repo.commits_between(pr["base"]["sha"], pr["head"]["sha"])
  end

  def get_authors(pr)
    commits = get_commits_between(pr)
    authors = []
    commits.each do |commit|
      authors.push(commit.author.name + " <" + commit.author.email + ">")
    end
    authors.uniq.to_a
  end

  def get_base_args(pr)
    {
      :clone => CONFIG["local"]["clone"],
      :remote => CONFIG["local"]["remote"],
      :org => CONFIG["repo"]["org"],
      :repo => CONFIG["repo"]["repo"],
      :base => pr["base"]["ref"],
      :head => pr["head"]["ref"],
      :user => pr["head"]["user"]["login"],
      :branch => pr["head"]["user"]["login"] + "-" + pr["head"]["ref"]
    }
  end

  def validate_pull_request(pull_req_id)
    pr = get_pull_req(pull_req_id)
    if pr["mergeable"]
      args = get_base_args(pr)
      validate = `#{Templates.validate(args)}`
      success = !(validate.include? "CONFLICT")
      [pr, success]
    else
      [pr, false]
    end
  end

  def merge_pull_request(pull_req_id, message)
    pr = get_pull_req(pull_req_id)
    args = get_base_args(pr)
    args[:message] = message
    `#{Templates.merge(args)}`
    pr
  end

  def merge_via_squash(pull_req_id, author, message)
    pr = get_pull_req(pull_req_id)
    args = get_base_args(pr)
    args[:title] = pr["title"] + "\n\n"
    args[:message] = message
    args[:pwd] = `pwd`.strip
    editor = `echo $GIT_EDITOR`.strip
    if editor.empty?
      editor = `git config --get core.editor`.strip
    end
    args[:editor] = editor
    args[:author] = author
    `#{Templates.squash(args)}`
    @current_branch, @modified_files = get_repo_status
    if (@modified_files.size.eql?(0) && CONFIG["app"]["auto_close"].eql?(true))
      close_pull_req(pr)
    end
    pr
  end

  def render_sidebar
    @current_branch, @modified_files = get_repo_status
    @new = true
    clean = @modified_files.empty?
    sidebar_html = erb :sidebar, :layout => false
    force_html = erb :force_reset, :layout => false
    {:html => sidebar_html, :clean => clean, :force_html => force_html}
  end

  def close_pull_req(pr)
    args = get_base_args(pr)
    merge_message = Templates.close_request(args)
    # Post a message on the issue
    do_request("https://api.github.com/repos/#{CONFIG["repo"]["org"]}/#{CONFIG["repo"]["repo"]}/issues/#{pr["number"]}/comments", false, "POST", {:body => merge_message})
    # Close the pull request, since it doesn't do it automatically when merging this way
    do_request("https://api.github.com/repos/#{CONFIG["repo"]["org"]}/#{CONFIG["repo"]["repo"]}/pulls/#{pr["number"]}", false, "PATCH", {:state => "closed"})
  end

  helpers do
    def md(text)
      $md_processor.render(text)
    end
    def h(text)
      Rack::Utils.escape_html(text)
    end
    def time_ago(text)
      time_ago_in_words(Time.parse(text))
    end
  end

  get "/" do
    @org_title = ORG_TITLE
    @org_url = "http://github.com/#{CONFIG["repo"]["org"]}"
    @repo_title = REPO_TITLE
    @repo_url = "http://github.com/#{CONFIG["repo"]["org"]}/#{CONFIG["repo"]["repo"]}"
    @current_branch, @modified_files = get_repo_status
    erb :index
  end

  get "/pulls" do
    params[:page] ||= 0
    pull_requests = get_pull_requests(params[:page])
    @pull_requests = pull_requests[:pull_requests]
    @assignees = pull_requests[:assignees]
    @labels = pull_requests[:labels]
    @current_branch, @modified_files = get_repo_status
    @page = params[:page].to_i
    @per_page = PER_PAGE.to_i
    pulls = erb :pulls, :layout => false
    has_next_page = @per_page.eql? @pull_requests.size
    content_type :json
    {:pulls => pulls, :has_next_page => has_next_page}.to_json
  end

  get "/sidebar" do
    content_type :json
    render_sidebar.to_json
  end

  get "/reset" do
    reset_to_master(params[:force])
    content_type :json
    render_sidebar.to_json
  end

  get "/validate/:pull_req_id" do
    @pr, success = validate_pull_request(params[:pull_req_id])
    if success
      @commits = get_commits_between(@pr)
      @authors = get_authors(@pr)
    end
    @current_branch, @modified_files = get_repo_status
    pr_html = erb :pull_request_validate, :layout => false
    content_type :json
    {:pr_html => pr_html, :sidebar=> render_sidebar, :success => success}.to_json
  end

  get "/merge/:pull_req_id" do
    @pr = get_pull_req(params[:pull_req_id])
    erb :merge, :layout => false
  end

  post "/merge/:method/:pull_req_id" do
    if params["method"].eql? "merge"
      merge_pull_request(params["pull_req_id"], params["message"])
    else
      merge_via_squash(params["pull_req_id"], params["author"].strip, params["message"])
    end
    content_type :json
    {:sidebar => render_sidebar, :success => true, :issue => params[:pull_req_id]}.to_json
  end

end