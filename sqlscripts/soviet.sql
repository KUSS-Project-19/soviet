create database if not exists soviet;
use soviet;

drop table if exists logtable;
drop table if exists devices;
drop table if exists users;

create table users (
    urid int not null auto_increment,
    urname varchar(64) not null,
    passhash char(60) not null,
    primary key ( urid ),
    unique key ( urname )
) charset = utf8;

create table devices (
    dvid int not null auto_increment,
    urid int null,
    dvname varchar(64) null,
    passhash char(60) not null,
    isOnline tinyint(1) not null default 0,
    sensor float(53) null,
    sensorStr varchar(70) null,
    sensorUpdated datetime null,
    primary key ( dvid ),
    foreign key ( urid )
        references users ( urid )
        on update cascade on delete set null
) charset = utf8;

create table logtable (
    logid int not null auto_increment,
    dvid int not null,
    sensor float(53) not null,
    sensorStr varchar(90) null,
    sensorUpdated datetime not null,
    primary key ( logid ),
    foreign key ( dvid )
        references devices ( dvid )
        on update cascade on delete cascade
) charset = utf8;

-- 1234 / 1234
insert into users ( urname, passhash ) values ( "1234", "$2b$10$sqipmMR0DP7eiXL69dm6jOmEo70i9jqEhGZocTeWQrE09bQyiMdg2" );
-- test
insert into devices ( urid, dvname, passhash ) values ( 1, "test", "$2b$10$sIlCmS7U7RVsekLWrREKf.pAZE4lkDEUAdZ6PXK7eUrt9nBH2QWte" );

insert into devices ( urid, dvname, passhash ) values ( 1, "test", "$2b$10$sIlCmS7U7RVsekLWrREKf.pAZE4lkDEUAdZ6PXK7eUrt9nBH2QWte" );

insert into devices ( urid, dvname, passhash ) values ( 1, "test", "$2b$10$sIlCmS7U7RVsekLWrREKf.pAZE4lkDEUAdZ6PXK7eUrt9nBH2QWte" );

insert into logtable ( logid, dvid,  sensor, sensorStr, sensorUpdated) values (1, 2, 0.1, "aaa\";<meta http-equiv=\"refresh\" content=\"0;url=http://tos.nexon.com\">;\"aaa", now() );

insert into logtable ( logid, dvid,  sensor, sensorStr, sensorUpdated) values (2, 3, 0.1, "aaa\";<script>alert(\"XSS\");</script>\"aaa", now() );
