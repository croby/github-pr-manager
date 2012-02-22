$(function() {
    var current_page = 1,
        merge_type = false,
        History = window.History;

    $(window).on('statechange', function() {
        var state = History.getState();
        if ( state.data.page ) {
            refresh_pull_requests( state.data.page );
        } else {
            show_pull_request( state.data.issue, state.data.github_url );
        }
    });

    var handle_pagination_click = function( $elt ) {
        if ( !$elt.parent( "li" ).hasClass( "disabled" ) ) {
            var direction = $elt.parent( "li" ).hasClass( "prev" ) ? -1 : 1;
            current_page += direction;
            History.pushState(
                {
                    page: current_page
                },
                document.title,
                "/pulls/" + current_page
            );
        }
    };

    var refresh_pull_requests = function( page, callback ) {
        current_page = page || current_page;
        $( "#main" ).fadeOut( "fast", function() {
            $( "#pull_request_loading" ).fadeIn( "fast", function() {
                $.ajax({
                    url: "/pulls/" + current_page,
                    success: function( data ) {
                        $( "#pull_request_loading" ).fadeOut( "fast", function() {
                            $( "#main" ).html( data.pulls ).show();
                            $( "#main" ).fadeIn( "fast" );
                            if ( $.isFunction(callback) ) {
                                callback();
                            }
                        });
                    }
                });
            });
        });
    };

    var refresh_sidebar = function ( data, doRequest ) {
        if ( doRequest ) {
            $.ajax({
                url: "/sidebar",
                success: function( data ) {
                    refresh_sidebar( data );
                }
            });
        } else {
            $( "div.sidebar" ).html( data.html ).find( ".new" ).fadeIn( "slow" );
            $( "pre.modified" ).html( $( "div.sidebar" ).find( ".modified" ).html() );
            if ( !data.clean ) {
                $( "#force_warning" ).html( data.force_html );
            }
        }
    };

    var do_reset = function( branch, force, callback ) {
        var params = {
            force: force || false
        };
        $.ajax({
            url: "/reset",
            type: "POST",
            data: params,
            success: function( data ) {
                refresh_sidebar( data.sidebar );
                $( ".current_branch" ).fadeOut( "fast", function() {
                    $( ".current_branch" ).text( data.branch ).fadeIn( "fast" );
                    if ( $.isFunction( callback ) ) {
                        callback();
                    }
                });
            }
        });
    };

    var show_pull_request = function( issue, url ) {
        $( "#main" ).fadeOut( "fast", function() {
            $( "#focus_loading" ).fadeIn( "fast", function() {
                get_pull_request( issue, function( data ) {
                    $( "#main" ).html( data );
                    $( "#focus_loading" ).fadeOut( "fast", function() {
                        $( "#main" ).fadeIn( "fast" );
                    });
                });
            });
        });
    };

    var get_pull_request = function( issue, callback ) {
        $.ajax({
            url: "/pull/" + issue,
            type: "GET",
            success: function( data ) {
                if ( $.isFunction( callback ) ) {
                    callback( data );
                }
            }
        });
    };

    var toggle_buttons = function( enable ) {
        if ( enable ) {
            $( ".focus_actions button" ).removeAttr( "disabled" );
        } else {
            $( ".focus_actions button" ).attr( "disabled", "disabled" );
        }
    };

    var working = function( starting ) {
        if ( starting ) {
            $( "#working" ).modal( "show" );
        } else {
            $( "#working" ).modal( "hide" );
        }
    };

    var do_validate = function( callback ) {
        var issue = $( "#pull_request_focus" ).attr("data-issue");
        $.ajax({
            url: "/validate/" + issue,
            type: "GET",
            success: function( data ) {
                if ( data.success ) {
                    $( ".current_branch" ).fadeOut( "fast", function() {
                        $( ".current_branch" ).text( data.branch ).fadeIn( "fast", function() {
                            if ( $.isFunction( callback ) ) {
                                callback();
                            }                            
                        });
                    });
                }
            }
        });
    };

    var show_merge = function( type, callback ) {
        merge_type = type;
        $( "#pull_request_focus .focus_actions" ).fadeOut( "fast", function() {
            $( ".focus_step[data-step='" + type + "']" ).fadeIn( "fast", function() {
                var top = $( ".focus_step[data-step='" + type + "']" ).offset().top;
                $( "html" ).animate({
                    scrollTop: top
                }, 200);
            });
        });
    };

    var cancel_merge = function( callback ) {
        $( ".focus_step[data-step]" ).fadeOut( "fast", function() {
            $( "#pull_request_focus .focus_actions" ).fadeIn( "fast", function() {
                if ( $.isFunction( callback ) ) {
                    callback();
                }
            });
        });
    };

    var get_merge_message = function() {
        var header = $( ".merge_message_header:visible" ).text();
        var body = $( ".merge_message:visible" ).val();
        return header + "\n\n" + body;
    };

    var do_merge = function( type, author, callback ) {
        var issue = $( "#pull_request_focus" ).attr("data-issue");
        var params = {
            message: get_merge_message()
        };
        if ( author ) {
            params.author = $.trim( author );
        }
        var url = "/merge/" + type + "/" + issue;
        $.ajax({
            url: url,
            type: "POST",
            data: params,
            success: function( data ) {
                if ( $.isFunction( callback ) ) {
                    callback( data );
                }
            }
        });
    };

    var finish_merge = function() {
        var issue = $( "#pull_request_focus" ).attr("data-issue");
        refresh_pull_requests( current_page, function() {
            $( ".pull_request[data-issue='" + issue + "']" ).fadeOut( "fast" );
        });
    };

    var add_bindings = function() {

        $( "body" ).on( "click", ".pagination li a", function( e ) {
            handle_pagination_click( $( this ) );
            e.preventDefault();
        });

        $( "#force_warning, #working" ).modal({
            backdrop: "static"
        });

        $( ".modal ").on( "click", "button.closebtn", function( e ) {
            $( this ).parents( ".modal" ).modal( "hide" );
        });

        $( "div.content" ).on( "click", ".pull_request", function( e ) {
            History.pushState(
                {
                    issue: $( this ).attr( "data-issue" ),
                    github_url: $( this ).attr( "data-github-url" )
                },
                document.title,
                "/pull/" + $( this ).attr( "data-issue" )
            );
            e.preventDefault();
        });

        $( "div.content" ).on( "click", "button#refresh_pulls", function( e ) {
            refresh_pull_requests( 1 );
        });

        $( "div.sidebar" ).on( "click", "button#refresh", function( e ) {
            refresh_sidebar( false, true );
        });

        $( "div.sidebar" ).on( "click", "button.reset", function( e ) {
            if ( $( this ).attr( "data-harshness" ) ) {
                $( "#force_warning" ).modal( "show" );
            } else {
                do_reset( "master" );
            }
        });

        $( "#force_warning" ).on( "click", "button", function( e ) {
            if ( $( this ).attr( "data-action" ) === "continue" ) {
                do_reset( "master", true );
            } else {
                $( "#force_warning" ).modal( "hide" );
            }
        });

        $( "body" ).on( "click", "#pull_request_focus button.back", function() {
            History.pushState(
                {
                    page: current_page
                },
                document.title,
                "/pulls/" + current_page
            );
        });

        $( "body" ).on( "click",
            "#pull_request_focus button[data-action]",
            function( e ) {
            var action = $( this ).attr( "data-action" );
            toggle_buttons( false );
            switch (action) {
                case "reset":
                    var branch = $( this ).attr( "data-base" );
                    do_reset( branch, false, function() {
                        toggle_buttons( true );
                    });
                    break;
                case "validate":
                    working( true );
                    do_validate( function() {
                        toggle_buttons( true );
                        working( false );
                    });
                    break;
                case "squash":
                    show_merge( "squash" );
                    break;
                case "merge":
                    show_merge( "merge" );
                    break;
                case "confirm":
                    working( true );
                    var author = false;
                    if ( merge_type === "squash" ) {
                        author = $( ".authors tr.selected" ).text();
                    }
                    do_merge( merge_type, author, function() {
                        finish_merge( );
                        working( false );
                    });
                    break;
                case "cancel":
                    cancel_merge( function() {
                        toggle_buttons( true );
                    });
                    break;
                default:
                    break;
            }
        });

        $( "body" ).on( "click",
            "#pull_request_focus .authors tr",
            function( e ) {
            if ( !$( this ).hasClass( "selected" ) ) {
                $( ".authors tr.selected" ).removeClass( "selected" );
                $( this ).addClass( "selected" );
            }
        });
    };

    var init = function() {
        add_bindings();
        if ( $( "#pull_request_focus" ).length === 0 ) {
            refresh_pull_requests();
        }
    };

    init();
});
